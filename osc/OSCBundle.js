OSCBundle.MAX_LENGTH = 1000;

function OSCBundle ()
{
 this.data = ["#".charCodeAt(0),"b".charCodeAt(0),"u".charCodeAt(0),"n".charCodeAt(0),"d".charCodeAt(0),"l".charCodeAt(0),"e".charCodeAt(0),0,0,0,0,0,0,0,0,1];
 this.messages = 0;
}

OSCBundle.prototype.init = function ()
{

};

OSCBundle.prototype.sizeArray = function (message){
 //TODO: Support message size > 255
 return [0,0,0,message.length];
}

OSCBundle.prototype.addMessage = function (message)
{
 if(this.data.length + message.length > OSCBundle.MAX_LENGTH)
  return false;

 //Add message size
 this.data = this.data.concat(this.sizeArray(message));
 
 //Add message
 this.data = this.data.concat(message);
 
 this.messages++;
 
 return true;
};