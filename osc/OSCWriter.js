// Written by J�rgen Mo�graber - mossgrabers.de
// (c) 2014-2015
// Licensed under LGPLv3 - http://www.gnu.org/licenses/lgpl-3.0.txt

OSCWriter.TRACK_ATTRIBS = [ "activated", "selected", "name", "volumeStr", "volume", "panStr", "pan", "color", "vu", "mute", "solo", "recarm", "monitor", "autoMonitor", "sends", "slots", "crossfadeMode" ];
OSCWriter.FXPARAM_ATTRIBS = [ "name", "valueStr", "value" ];

function OSCWriter (model, oscPort)
{
    this.model   = model;
    
    this.oldValues = {};
    this.messages = [];
}

OSCWriter.prototype.flush = function (dump)
{
    //
    // Transport
    //

    var trans = this.model.getTransport ();
    this.sendOSC ('/play', trans.isPlaying, dump);
    this.sendOSC ('/record', trans.isRecording, dump);
    this.sendOSC ('/overdub', trans.isOverdub, dump);
    this.sendOSC ('/overdub/launcher', trans.isLauncherOverdub, dump);
    this.sendOSC ('/repeat', trans.isLooping, dump);
    this.sendOSC ('/click', trans.isClickOn, dump);
    this.sendOSC ('/preroll', trans.getPreroll (), dump);
    this.sendOSC ('/tempo/raw', trans.getTempo (), dump);
    this.sendOSC ('/crossfade', trans.getCrossfade (), dump);
    this.sendOSC ('/autowrite', trans.isWritingArrangerAutomation, dump);
    this.sendOSC ('/autowrite/launcher', trans.isWritingClipLauncherAutomation, dump);
    this.sendOSC ('/automationWriteMode', trans.automationWriteMode, dump);

    //
    // Frames
    //
    
    var app = this.model.getApplication ();
    this.sendOSC ('/layout', app.getPanelLayout ().toLowerCase (), dump);

    var arrange = this.model.getArranger ();
    this.sendOSC ('/arranger/cueMarkerVisibility', arrange.areCueMarkersVisible (), dump);
    this.sendOSC ('/arranger/playbackFollow', arrange.isPlaybackFollowEnabled (), dump);
    this.sendOSC ('/arranger/trackRowHeight', arrange.hasDoubleRowTrackHeight (), dump);
    this.sendOSC ('/arranger/clipLauncherSectionVisibility', arrange.isClipLauncherVisible (), dump);
    this.sendOSC ('/arranger/timeLineVisibility', arrange.isTimelineVisible (), dump);
    this.sendOSC ('/arranger/ioSectionVisibility', arrange.isIoSectionVisible (), dump);
    this.sendOSC ('/arranger/effectTracksVisibility', arrange.areEffectTracksVisible (), dump);

    var mix = this.model.getMixer ();
    this.sendOSC ('/mixer/clipLauncherSectionVisibility', mix.isClipLauncherSectionVisible (), dump);
    this.sendOSC ('/mixer/crossFadeSectionVisibility', mix.isCrossFadeSectionVisible (), dump);
    this.sendOSC ('/mixer/deviceSectionVisibility', mix.isDeviceSectionVisible (), dump);
    this.sendOSC ('/mixer/sendsSectionVisibility', mix.isSendSectionVisible (), dump);
    this.sendOSC ('/mixer/ioSectionVisibility', mix.isIoSectionVisible (), dump);
    this.sendOSC ('/mixer/meterSectionVisibility', mix.isMeterSectionVisible (), dump);
    
    //
    // Master-/Track(-commands)
    //
    
	var tb = this.model.getTrackBank ();
	for (var i = 0; i < tb.numTracks; i++)
        this.flushTrack ('/clipgrid/track/', i, tb.getTrack (i), dump);
    this.flushTrack ('/master/',-1 , this.model.getMasterTrack (), dump);

    //
    // Device
    //

    var cd = this.model.getCursorDevice ();
    var selDevice = cd.getSelectedDevice ();
    this.sendOSC ('/device/name', selDevice.name, dump);
    this.sendOSC ('/device/bypass', !selDevice.enabled, dump);
	for (var i = 0; i < cd.numParams; i++)
    {
        var oneplus = i + 1;
        this.flushFX ('/device/param/' + oneplus + '/', cd.getFXParam (i), dump);
        this.flushFX ('/device/common/' + oneplus + '/', cd.getCommonParam (i), dump);
        this.flushFX ('/device/envelope/' + oneplus + '/', cd.getEnvelopeParam (i), dump);
        this.flushFX ('/device/macro/' + oneplus + '/', cd.getMacroParam (i), dump);
        this.flushFX ('/device/modulation/' + oneplus + '/', cd.getModulationParam (i), dump);
    }
    this.sendOSC ('/device/category', cd.categoryProvider.selectedItemVerbose, dump);
    this.sendOSC ('/device/creator', cd.creatorProvider.selectedItemVerbose, dump);
    this.sendOSC ('/device/preset', cd.presetProvider.selectedItemVerbose, dump);

    //
    // Primary Device
    //

    cd = tb.primaryDevice;
    var selDevice = cd.getSelectedDevice ();
    this.sendOSC ('/primary/name', selDevice.name, dump);
    this.sendOSC ('/primary/bypass', !selDevice.enabled, dump);
	for (var i = 0; i < cd.numParams; i++)
    {
        var oneplus = i + 1;
        this.flushFX ('/primary/param/' + oneplus + '/', cd.getFXParam (i), dump);
        this.flushFX ('/primary/common/' + oneplus + '/', cd.getCommonParam (i), dump);
        this.flushFX ('/primary/envelope/' + oneplus + '/', cd.getEnvelopeParam (i), dump);
        this.flushFX ('/primary/macro/' + oneplus + '/', cd.getMacroParam (i), dump);
        this.flushFX ('/primary/modulation/' + oneplus + '/', cd.getModulationParam (i), dump);
    }
    this.sendOSC ('/primary/category', cd.categoryProvider.selectedItemVerbose, dump);
    this.sendOSC ('/primary/creator', cd.creatorProvider.selectedItemVerbose, dump);
    this.sendOSC ('/primary/preset', cd.presetProvider.selectedItemVerbose, dump);
    
    //
    // User
    //
    
    var user = this.model.getUserControlBank ();
	for (var i = 0; i < cd.numParams; i++)
        this.flushFX ('/user/param/' + (i + 1) + '/', user.getUserParam (i), dump);

    if (this.messages.length == 0)
    {
        this.messages = [];
        return;
	}
    
    while (msg = this.messages.shift ())
        host.sendDatagramPacket (Config.sendHost, Config.sendPort, msg);
};

OSCWriter.prototype.flushTrack = function (trackAddress, trackindex, track, dump)
{
    for (var a = 0; a < OSCWriter.TRACK_ATTRIBS.length; a++)
    {
        var p = OSCWriter.TRACK_ATTRIBS[a];
        switch (p)
        {
            case 'sends':
                if (!track.sends)
                    continue;
                for (var j = 0; j < 8; j++)
                {
                    var s = track.sends[j];
                    for (var q in s)
                        this.sendOSC (trackAddress + 'send/' + (j + 1) + '/' + q, s[q], dump);
                }
                break;
                
            case 'slots':
                if (!track.slots || trackindex == -1)
                    continue;
                for (var j = 0; j < 8; j++)
                {
                    var s = track.slots[j];
                    for (var q in s)
                    {
                        var address = '/clipgrid/clip/' + q;
                        switch (q)
                        {
                            case 'color':
                                var color = AbstractTrackBankProxy.getColorEntry (s[q]);
                                if (color)
                                    this.sendClipGridOSCColor (address,trackindex,j+1,color[0], color[1], color[2], dump);
                                break;
                            case 'index':
                                 //Don't send this message
                                 break;
                            default:
                                this.sendOSC (address, [trackindex, j+1, s[q]], dump);
                                break;
                        }
                    }
                }
                break;
                
            case 'color':
                var color = AbstractTrackBankProxy.getColorEntry (track[p]);
                if (color)
                    this.sendTrackGridOSCColor (trackAddress + p, trackindex, color[0], color[1], color[2], dump);
                break;
                
            case 'crossfadeMode':
                this.sendOSC (trackAddress + p + '/A', track[p] == 'A', dump);
                this.sendOSC (trackAddress + p + '/B', track[p] == 'B', dump);
                this.sendOSC (trackAddress + p + '/AB', track[p] == 'AB', dump);
                break;
                
            default:
                this.sendOSC (trackAddress + p, [trackindex,track[p]], dump);
                break;
        }
	}
};

OSCWriter.prototype.flushFX = function (fxAddress, fxParam, dump)
{
    for (var a = 0; a < OSCWriter.FXPARAM_ATTRIBS.length; a++)
    {
        var p = OSCWriter.FXPARAM_ATTRIBS[a];
        this.sendOSC (fxAddress + p, fxParam[p], dump);
	}
};

OSCWriter.prototype.sendOSC = function (address, value, dump)
{
    //if(address.indexOf('/clipgrid/') != -1 && address.indexOf('track') != -1)
    //  println("addr: " + address + " value: " + value);
    if(!dump && value instanceof Array){
        if (address in this.oldValues){
            if(value.length == this.oldValues[address]){
                var matching = true;
                for(var i=0; i<value.length; i++){
                    if(value[i] != this.oldValues[address][i]){
                        matching = false;
                        break;
                    }
                }
                if(matching)
                    return;
            }
        }
    }else if (!dump && this.oldValues[address] === value)
        return;
    
    
    this.oldValues[address] = value;

    //Convert booleans to int for client compatibility
    if(value instanceof Array){
        for(var i=0;i<value.length;i++){
            if(typeof(value[i]) == 'boolean')
                value[i] = (value[i]) ? 1 : 0;
        }
    }else if(typeof(value) == 'boolean')
        value = (value) ? 1 : 0;
    
        
    var msg = new OSCMessage ();
    msg.init (address, value);
    this.messages.push (msg.build ());
};

OSCWriter.prototype.sendOSCColor = function (address, red, green, blue, dump)
{
    //var color = Math.round (red * 8323072) + Math.round (green * 32512) + Math.round (blue * 127);
    var color = "RGB(" + red + "," + green + "," + blue + ")";
    this.sendOSC (address, color, dump);
};

OSCWriter.prototype.sendClipGridOSCColor = function (address, trackindex, clipindex, red, green, blue, dump)
{

    this.sendOSC (address, [trackindex, clipindex, red,green,blue], dump);
};

OSCWriter.prototype.sendTrackGridOSCColor = function (address, trackindex, red, green, blue, dump)
{
    this.sendOSC (address, [trackindex, red,green,blue], dump);
};
