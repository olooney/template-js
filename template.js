

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
		[/^\s*block\s.*$/, ''], // TODO
		[/^\s*endblock.*$/, ''], // TODO
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


function compile(src) {
	var pattern = /(\{%(.*?)%\})/gm;
	var match = pattern.exec(src);
	var lastEnd = 0;
	
	var pieces = ['var lines=[];with(arguments[0]||{}){'];

	function pushText(text) { 
		if ( !text ) return;
		pieces.push('lines.push(');
		pieces.push( compileText(text) );
		pieces.push(');');
	}

	while ( match ) {
		pushText(src.slice(lastEnd, match.index));
		var block = match[2];
		pieces.push(  autoBracket(block) );
		lastEnd = match.index + match[0].length;
		match = pattern.exec(src);
	}
	pushText(src.slice(lastEnd));

	pieces.push(" } return lines.join('');");
	return new Function(pieces.join(''));
}
