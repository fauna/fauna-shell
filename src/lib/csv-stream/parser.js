/*!
 * csv-stream
 * Copyright(c) 2012 HipSnip Limited
 * Author Rémy Loubradou <remyloubradou@gmail.com>
 * MIT Licensed
 * 
 * Originally imported to Fauna Shell from this file:
 * https://github.com/lbdremy/node-csv-stream/blob/8aea01108b/lib/parser.js
 */

/**
 * Modules dependencies
 */

var EventEmitter = require('events').EventEmitter,
	util = require('util');

module.exports = Parser;

function Parser(options){
	EventEmitter.call(this);
	this.delimiter = options ? options.delimiter || ',' : ',';
	this.endLine = options ? options.endLine || '\n' : '\n';
	this.enclosedChar = options ? options.enclosedChar || '' : '';
	this.escapeChar = options ? options.escapeChar || '' : '';
	this.columnOffset = options ? options.columnOffset || 0 : 0;

	this._defaultColumns =  options ? !!options.columns : false;
	this.columns = options ? options.columns || [] : [];
	this._currentColumn = 0;
	this._index = 0;
	this._line = {};
	this._text = '';
	this._enclosing = null;
}


// Inherits from EventEmitter
util.inherits(Parser,EventEmitter);

Parser.prototype.end = function(s){
	if(s) this.parse(s);
	if(this._text || Object.getOwnPropertyNames(this._line).length){
		if(this._text[this._text.length -1] === '\r') this._text = this._text.slice(0,this._text.length - 1);
		this.emit('column',this.columns[this._currentColumn],this._text);
		this._line[this.columns[this._currentColumn]] = this._text;
		this.emit('data',this._line);
	}
	this.emit('end');
}

Parser.prototype.parse = function(s){
	for(var i = 0; i < s.length; i++){
		var c = s[i];
		if(this.escapeChar === c && this._enclosing && s[i+1] === this.enclosedChar){
			i++;
			this._text = this._text + s[i];
		}else{
			if(this.enclosedChar === c){
				this._enclosing = !this._enclosing;
			}else if(this.delimiter === c){
				if(this._enclosing){
					this._text = this._text + c;
				}else{
					if(this._index < this.columnOffset){
						//skip line
					}else if(this._index === this.columnOffset && !this._defaultColumns){
						this.columns[this._currentColumn] = this._text;
					}else{
						this.emit('column',this.columns[this._currentColumn],this._text);
						this._line[this.columns[this._currentColumn]] = this._text;
					}
					this._text = '';
					this._currentColumn++;
				}
			}else if(this.endLine === c){ //LF
				if(this._enclosing){
					this._text = this._text + c;
				}else{
					if(this._text[this._text.length -1] === '\r') this._text = this._text.slice(0,this._text.length - 1);
					if(this._index < this.columnOffset){
						//skip line
					}else if(this._index === this.columnOffset && !this._defaultColumns){
						this.columns[this._currentColumn] = this._text;
						this.emit('header',this.columns);
					}else{
						this.emit('column',this.columns[this._currentColumn],this._text);
						this._line[this.columns[this._currentColumn]] = this._text;
						this.emit('data',this._line);
					}
					this._index++;
					this._currentColumn = 0;
					this._line = {};
					this._text = '';
				}
			}else{
				this._text = this._text + c;
			}
		}

	}
}
