// Written by J・gen Moﾟgraber - mossgrabers.de
// (c) 2014-2015
// Licensed under LGPLv3 - http://www.gnu.org/licenses/lgpl-3.0.txt

LemurWriter.TRACK_ATTRIBS = [ "activated", "selected", "name", "volumeStr", "volume", "panStr", "pan", "color", "vu", "mute", "solo", "recarm", "monitor", "autoMonitor", "sends", "slots", "crossfadeMode" ];
LemurWriter.FXPARAM_ATTRIBS = [ "name", "valueStr", "value" ];

function LemurWriter (model, oscPort)
{
    this.model   = model;
 
    this.oldValues = {};
    this.trie = {};
    this.messages = [];
}

LemurWriter.prototype.flush = function (dump)
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
        this.flushTrack ('/track/' + (i + 1) + '/', i, tb.getTrack (i), dump);
    this.flushTrack ('/master/', -1,this.model.getMasterTrack (), dump);

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

LemurWriter.prototype.flushTrack = function (trackAddress, trackGridNumber, track, dump)
{
    var trackGridAddress = '/grid/track/';
    for (var a = 0; a < LemurWriter.TRACK_ATTRIBS.length; a++)
    {
        var p = LemurWriter.TRACK_ATTRIBS[a];
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
                if (!track.slots || trackGridNumber==-1)
                    continue;
                for (var j = 0; j < 8; j++)
                {
                    var s = track.slots[j];
                    for (var q in s)
                    {
                        var address = trackAddress + 'clip/' + (j + 1) + '/' + q;
                        var clipGridAddress = '/grid/clip/' + q;
                        switch (q)
                        {
                            case 'color':
                                var color = AbstractTrackBankProxy.getColorEntry (s[q]);
                                if (color)
                                    this.sendOSCGrid (clipGridAddress, [trackGridNumber,j], [color[0], color[1], color[2]], dump);
                                break;
                            default:
                                this.sendOSCGrid (clipGridAddress, [trackGridNumber,j], s[q], dump);
                                break;
                        }
                    }
                }
                break;
                
            case 'color':
                var color = AbstractTrackBankProxy.getColorEntry (track[p]);
                if (color){
                    if(trackGridNumber!=-1)
                        this.sendOSCGrid (trackGridAddress+p,[trackGridNumber],[color[0], color[1], color[2]],dump);
                    this.sendOSC (trackAddress + p, [color[0], color[1], color[2]], dump);
                }
                break;
                
            case 'crossfadeMode':
                this.sendOSC (trackAddress + p + '/A', track[p] == 'A', dump);
                this.sendOSC (trackAddress + p + '/B', track[p] == 'B', dump);
                this.sendOSC (trackAddress + p + '/AB', track[p] == 'AB', dump);
                break;
                
            case 'vu':
                if (Config.enableVUMeters)
                    this.sendOSC (trackAddress + p, track[p], dump);
                break;
                
            default:
                if(trackGridNumber!=-1)
                    this.sendOSCGrid(trackGridAddress+p,[trackGridNumber],track[p],dump);
                this.sendOSC (trackAddress + p, track[p], dump);
                break;
        }
	}
};

LemurWriter.prototype.flushFX = function (fxAddress, fxParam, dump)
{
    for (var a = 0; a < LemurWriter.FXPARAM_ATTRIBS.length; a++)
    {
        var p = LemurWriter.FXPARAM_ATTRIBS[a];
        this.sendOSC (fxAddress + p, fxParam[p], dump);
	}
};

LemurWriter.prototype.sendOSC = function (address, value, dump)
{
    
    var cleanAddress = address.replace(/\//g,'').toLowerCase();
    if (!dump)
    {
        var trieArray = this.trieGet(cleanAddress,this.trie,0);
        var trieData = trieArray[1];
        if(trieArray[0]){
            if(typeof(trieData) == 'array'){
                if (this.compareArray (trieData, value)){
                    return;
                }
            }else if(trieData == value){
                return;
            }
        
        }
    }
    
    this.trieSet(cleanAddress,value,this.trie,0);

    // Convert boolean values to integer for client compatibility
    if (value instanceof Array)
    {
        for (var i = 0; i < value.length; i++)
            value[i] = this.convertBooleanToInt (value[i]);
    }
    else
        value = this.convertBooleanToInt (value);

    var msg = new OSCMessage ();
    msg.init (address, value);
    this.messages.push (msg.build ());
    
};

LemurWriter.prototype.sendOSCGrid = function (address, valueAddress, value, dump)
{
    var gridAddress = (address.replace(/\//g,'') + valueAddress.toString().replace(/,/g,'')).replace(' ','').toLowerCase();
    if (!dump)
    {
        var trieArray = this.trieGet(gridAddress,this.trie,0);
        var trieData = trieArray[1];
        if(trieArray[0]){
            if(typeof(trieData) == 'array'){
                if (this.compareArray (trieData, value)){
                    return;
                }
            }else if(trieData == value){
                return;
            }
        
        }
    }
    this.trieSet(gridAddress,value,this.trie,0);
    
    // Convert boolean values to integer for client compatibility
    if (value instanceof Array)
    {
        for (var i = 0; i < value.length; i++)
            value[i] = this.convertBooleanToInt (value[i]);
    }
    else
        value = this.convertBooleanToInt (value);

    var msg = new OSCMessage ();
    msg.init (address, valueAddress.concat(value));
    this.messages.push (msg.build ());
    
};


LemurWriter.prototype.convertBooleanToInt = function (value)
{
    return typeof (value) == 'boolean' ? (value ? 1 : 0) : value;
};

LemurWriter.prototype.trieSet = function(path,value,trie,depth){
   if(path.length>0){
       if(typeof(trie[path.charAt(0)]) != 'object') 
           trie[path.charAt(0)] = {};
       this.trieSet(path.substring(1),value,trie[path.charAt(0)],depth+1);
   }
   
   trie['data'] = value;
};

LemurWriter.prototype.trieGet = function(path,trie,depth){
   if(path.length>0){
       if(path.charAt(0) in trie){
           if(path.length != 1){
               return this.trieGet(path.substring(1),trie[path.charAt(0)],depth+1);
           }else{
               return [true,trie[path.charAt(0)]['data']];
           }
       }else{
           return [false,0];
       }
   }

   return [false,0];
};

LemurWriter.prototype.compareArray = function (a1, a2)
{
    if(a1.length != a2.length)
        return false;
    for (var i = 0; i < a1.length; i++)
    {
        if (a1[i] != a2[i])
            return false;
    }
    return true;
};
