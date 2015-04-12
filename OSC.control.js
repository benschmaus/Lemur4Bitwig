// Written by Jürgen Moßgraber - mossgrabers.de
// (c) 2014-2015
// Licensed under LGPLv3 - http://www.gnu.org/licenses/lgpl-3.0.txt

loadAPI (1);
load ("framework/helper/ClassLoader.js");
load ("framework/daw/ClassLoader.js");
load ("osc/ClassLoader.js");
load ("Config.js");

host.defineController ("Liine", "Lemur", "0.1", "6513e1fa-decc-11e4-8c75-1681e6b88ec1", "Carroll Vance");
host.defineMidiPorts (1, 0);

var model = null;
var parser = null;
var writer = null;
var limiter = 0;

String.prototype.getBytes = function () 
{
	var bytes = [];
	for (var i = 0; i < this.length; i++) 
		bytes.push (this.charCodeAt(i));
	return bytes;
};

function init ()
{
    Config.init ();
    var scales = new Scales (0, 128, 128, 1);
    scales.setChromatic (true);
    model = new Model (70, scales, 8, 8, 8);

    parser = new OSCParser (model, Config.receiveHost, Config.receivePort);
    writer = new LemurWriter (model);
    
    offlineFlush();
    
	   println ("Initialized.");

}

function exit ()
{
}

function offlineFlush(){
    var trans = model.getTransport ();
    if(!trans.isPlaying){
        writer.flush (false);
    }
    scheduleTask (offlineFlush, null, 1000);
}

function flush ()
{
    if(limiter == 10){
       writer.flush (false);
       limiter = 0;
    }
    limiter++;
}
