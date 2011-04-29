

function compileText(src) {
	var pattern = /(\{\{(.*?)\}\})/gm;

	var match = pattern.exec(src);
	var lastEnd = 0;

	var pieces = [];
	while ( match ) {
		var text = src.slice(lastEnd, match.index);
		if ( text ) pieces.push(JSON.stringify(text));
		var block = match[2];
		pieces.push( '(' + block + ')');
		lastEnd = match.index + match[0].length;
		match = pattern.exec(src);
	}
	var text = src.slice(lastEnd);
	if ( text ) pieces.push(JSON.stringify(text));
	return "[" + pieces.join(',') + "].join('')";
}

// add parens and squigly brackets as needed to block constructs.
var autoBracket = (function() {
	var known = [
		[/^\s*block\s+(\w+)\s*$/, 'block $1'],
		[/^\s*endblock\s+(\w*)\s*$/, 'endblock $1'],
		[/^\s*if\s*(.*)$/, 'if($1){'],
		[/^\s*else\s+if\s*(.*)$/, '}else if($1){'],
		[/^\s*else/, '}else{'],
		[/^\s*end.*$/, '}'],
		[/^\s*for\s+each\s+(\w+)\s*,\s*(\w+)\s+in(.*)$/, 'for(var $2=0; $2<($3).length; $2++){var $1=($3)[$2];'],
		[/^\s*for\s*(.*)$/, 'for($1){'],
		[/^\s*switch\s*(.*)$/, 'switch($1){'],
		[/^\s*case\s*(.*)$/, 'case $1:'],
		[/^\s*default\s*$/, 'default:']
	];
	var length = known.length;
	return function(block) {
		for ( var i=0; i<length; i++ ) {
			var pair = known[i];
			if ( pair[0].test(block) ) {
				return block.replace(pair[0], pair[1]);
			}
		}
		return block.replace(/^\s+|\s+$/g, '') + ';';
	}
})();

function Frame(name) {
	this.name = name;
	this.lines = ['var lines=[];with(context||{}){'];
}
Frame.prototype = {
	constructor: Frame,
	add: function(line) {
		this.lines.push(line);
	},
	compile: function() {
		this.lines.push(" } return lines.join('');");
		var fn = new Function('context', this.lines.join(''));
		this.lines.pop();
		return fn;
	}
};

function compile(src, parentTemplate) {
	var pattern = /(\{%(.*?)%\})/gm;
	var match = pattern.exec(src);
	var lastEnd = 0;
	
	var stack = [ new Frame('root') ];
	var blocks = {};

	if ( parentTemplate ) {
		for ( var name in parentTemplate.blocks ) {
			blocks[name] = parentTemplate.blocks[name];
		}
	}

	function top() { return stack[stack.length-1]; }

	function pushText(text) { 
		if ( !text ) return;
		top().add('lines.push(');
		top().add( compileText(text) );
		top().add(');');
	}

	while ( match ) {
		// take everything to up but not including the matched block tag.
		pushText(src.slice(lastEnd, match.index));

		var tag = autoBracket(match[2]);
		var block = (/^block (\w+)$/).exec(tag);
		var endblock = (/^endblock (\w*)$/).exec(tag);
		if ( block ) {
			var blockName = block[1];
			console.log('block', blockName);
			// todo: throw if duplicate?
			top().add('lines.push(this.' + blockName + '(context));');
			stack.push( new Frame(blockName) );
		} else if ( endblock ) {
			var blockName = endblock[1];
			console.log('endblock', blockName);
			if ( blockName === '' || blockName === top().name ) {
				blocks[ top().name ] = top().compile();
				stack.pop();
			} else {
				throw new Error("mismatched endblock " + blockName + " in block " + top().name);	
			}
		} else {
			// treat the tag as code.  Brackets have already been added if needed.
			stack[stack.length-1].add(tag);
		}
		lastEnd = match.index + match[0].length;
		match = pattern.exec(src);
	}
	pushText(src.slice(lastEnd));
	
	if ( stack.length !== 1 ) {
		throw new Error("unclosed blocks!");
	}
	if ( !blocks.root ) {
		blocks.root = stack[0].compile();
	}

	function template(context) {
		return arguments.callee.blocks.root(context);
	}
	template.blocks = blocks;
	template.toCodeString = function() {
		var blocks = this.blocks;
		var methods = [];
		for ( var name in blocks ) {
			methods.push(name + ': ' + blocks[name]);
		}
		return 'Template({' + methods.join(',') + '})';
	}
	return template;
}
