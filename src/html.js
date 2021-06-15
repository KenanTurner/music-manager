import _Track from './plugins/custom.js';
export default class HTML{
	static Track = class Track extends _Track{
		constructor(obj){
			super(obj);
			this.filetype = "HTML"; //overriding
		}
		static fromJSON(json){
			return new HTML.Track(JSON.parse(json));
		}
	}
	constructor(){
		this._player = new Audio();
		this._ready = true;
		this._subscribers = {all:[]};
		
		let self = this;
		//this._player.addEventListener('canplay',function(){self._publish('canplay')});
		//this._player.addEventListener('abort',function(){self._publish('abort')});
		this._player.addEventListener('play',function(){self._publish('play')});
		this._player.addEventListener('pause',function(){self._publish('pause')});
		this._player.addEventListener('ended',function(){self._publish('ended')});
		this._player.addEventListener('error',function(){self._publish('error')});
		this._player.addEventListener('timeupdate',function(){self._publish('timeupdate')});
		this._player.addEventListener('volumechange',function(){self._publish('volumechange')});
	}
	destroy(){
		//console.log("DESTROY!!!");
		if(this._player.constructor.name == "HTMLAudioElement") this._player.load();
		this._ready = false;
		delete this._player;
		delete this._subscribers;
		return Promise.resolve();
	}
	subscribe(type,f,options) {
		let obj = {callback:f}
		if(typeof obj.callback != "function") throw new Error("Callback must be a function");
		if(options) obj.once = options.once;
		if(options) obj.error = options.error;
		if (!this._subscribers[type]) {
			this._subscribers[type] = []; //creates the event list
		}
		this._subscribers[type].push(obj);
		if(type == 'ready' && this._ready) this._publish('ready');
	}
	
	unsubscribe(type,f,options){
		let obj = {callback:f}
		if(typeof obj.callback != "function") throw new Error("Callback must be a function");
		if(options) obj.once = options.once;
		if(options) obj.error = options.error;
		if(this._subscribers[type]){
			var subs = this._subscribers[type].filter(function(item){
				return item === obj;
			});
			this._subscribers[type] = subs;
		}
	}
	_publish(type){
		if(!this._ready) return;
		let self = this;
		this.getStatus().then(function(data){
			if(!this._ready) return;
			let event = new HTML.Event(type,data);
			this._subscribers.all.forEach(function(obj,index,array){
				obj.callback(event);
				if(obj.once) array.splice(index,1);
			});
			switch(type){
				case "error": //reject promises
					for (var _type in self._subscribers){
						self._subscribers[_type].forEach(function(obj,index,array){
							if(obj.error){
								obj.error(event);
								if(obj.once) array.splice(index,1);
							}
						});
					};
				default:
					if (!this._subscribers[type]){return;}
					this._subscribers[type].forEach(function(obj,index,array){
						obj.callback(event);
						if(obj.once) array.splice(index,1);
					});
					break;
			}
			return Promise.resolve(event);
		}.bind(this))
	}
	load(track){
		if(!this.constructor._validTrack(track)) throw new Error("Invalid Filetype");
		let f = function(){
			this._publish('loaded');
		}.bind(this);
		this._player.addEventListener('canplay',f,{once:true});
		this._player.src = track.src;
		return this.waitForEvent('loaded');
	}
	play(){
		return this._player.play();
		//return this.waitForEvent('play');
	}
	pause(){
		return this._player.pause();
		return this.waitForEvent('pause');
	}
	seek(time){
		let f = function(){
			this._publish('timeupdate');
		}.bind(this);
		this._player.addEventListener('seeked',f,{once:true});
		this._player.currentTime = time;
		return this.waitForEvent('timeupdate');
	}
	fastForward(time){
		return this.seek(this._player.currentTime + time);
	}
	setVolume(vol){
		this._player.volume = vol;
		return this.waitForEvent('volumechange');
	}
	stop(){
		let f = function(){
			this._publish('loaded');
		}.bind(this);
		this._player.addEventListener('canplay',f,{once:true});
		this._player.load();
		return this.waitForEvent('loaded');
		
		//this._player.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=';
	}
	getStatus(){
		return Promise.resolve(this._status());
	}
	_status(){
		let data = {
			src:this._player.currentSrc,
			time:this._player.currentTime,
			duration:this._player.duration,
			volume:this._player.volume,
			paused:this._player.paused
		}
		return data;
	}
	wait(f,g,callback,step=50){
		if(f() != g) return callback();
		let self = this;
		setTimeout(function(){ self.wait(f,g,callback,step)}, step);
	}
	waitForEvent(event) {
		let self = this;
		return new Promise(function(resolve, reject) {
			self.subscribe(event,resolve,{once:true,error:reject});
		});
	}
	chain(f,...args){ //easy promise chaining
		return function(evt){
			return this[f](...args);
		}.bind(this)
	}
	static error(event){
		console.log("Error playing the specified file",event);
	}
	static loadScript(url, callback){
		var head = document.head;
		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = url;
		script.onreadystatechange = callback;
		script.onload = callback;
		head.appendChild(script);
	}
	static Event = class Event{
		constructor(type,data){
			this.type = type;
			this.data = data;
		}
	}
	static _promise_loadScript(url){ //promise variant
		var head = document.head;
		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = url;
		return new Promise(function(resolve,reject){
			script.onreadystatechange = resolve;
			script.onload = resolve;
			script.onerror = reject;
			head.appendChild(script);
		});		
	}
	static _validTrack(track){
		let p = this.Track.prototype.isPrototypeOf(track);
		let f = this.name == track.filetype;
		return (p && f);
	}
	static _validURL(url){
		try{
			let tmp = new URL(url);
			let type = tmp.pathname.split('.').pop();
			type = type.toUpperCase();
			switch(type){
				case "WAV":
				case "MP3":
				case "MP4":
				case "M4A":
				case "AAC":
				case "ADTS":
				case "OGG":
				case "OGA":
				case "MOGG":
				case "FLAC":
				case "WEBM":
					return true;
			}
			return false;
		}catch(e){
			return false;
		}
	}
	//TODO _getHTMLAudioDuration
	//TODO upload class?
}