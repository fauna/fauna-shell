/*!
 * csv-stream
 * Copyright(c) 2012 HipSnip Limited
 * Author Rémy Loubradou <remyloubradou@gmail.com>
 * MIT Licensed
 *
 * Originally imported to Fauna Shell from this file:
 * https://github.com/lbdremy/node-csv-stream/blob/8aea01108b/index.js
 */

/**
 * Modules dependencies
 */

var Stream = require('stream'),
	util = require('util'),
	Parser = require('./lib/parser');

exports.createStream = function(options){
	return new CSVStream(options || {});
}

function CSVStream(options){
	var self = this;
	Stream.call(this);

	// States
	this.writable = true;
	this.readable = true;
	this._paused = false;
	this._ended = false;
	this._destroyed = false;
	this._endCallWhenPause = false;

	// Buffer
	this._buffer = new Buffer(0);
	this._encoding = undefined; // Encoding needs to be undefined for Buffer.toString method

	// CSV parser
	this._parser = new Parser(options);
	this._parser.on('data',function(data){
		if(self._ended) throw new Error('Must not emit data event after emittion of end event.')
		self.emit('data',data);
	});
	this._parser.on('column',function(key,value){
		self.emit('column',key,value);
	});
	this._parser.on('header',function(header){
		self.emit('header',header);
	});
	this._parser.on('end',function(){
		self._ended = true;
		self.readable = false;
		self.emit('end');
	});
}

util.inherits(CSVStream,Stream);

CSVStream.prototype.write = function(buffer,encoding){
	this._encoding = encoding || this._encoding;
	if(this._ended) throw new Error('Cannot write after end has been called.');
	if(buffer) this._buffer = Buffer.concat([this._buffer, buffer], this._buffer.length + buffer.length);
	if(this._paused) return false;
	this._parser.parse(this._buffer.toString(this._encoding));
	this._buffer = new Buffer(0);
	return !this._paused;
}

CSVStream.prototype.end = function(buffer,encoding){
	if(this._buffer || buffer){
		if(this.write(buffer,encoding)){
			this.writable = false;
			this._parser.end();
			if(!this._destroyed) this.destroy();
		}else{
			this._endCallWhenPause = true;
		}
	}
}

CSVStream.prototype.destroy = function(){
	this._buffer = null;
	this._destroyed = true;
	this.emit('close');
}

CSVStream.prototype.pause = function(){
	this._paused = true;
}

CSVStream.prototype.resume = function(){
	this._paused = false;
	if(this._buffer && this._buffer.length > 0 && !this._endCallWhenPause) this.write();
	if(this._endCallWhenPause) this.end();
	this.emit('drain');
}
