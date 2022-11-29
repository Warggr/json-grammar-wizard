var content = undefined;

var completeGrammar = undefined;

function makeWord(content){
	if(content == null){
		throw new Error('Literal null matches nothing');
	} else if(typeof content === 'number'){
		throw new Error('Number literal matches nothing: ', content);
	} else if(typeof content === 'string'){
		if(!completeGrammar.hasOwnProperty(content)) throw new Error('Varname ' + content + ' not found');
		else return makeWord(completeGrammar[content]);
	} else if(Array.isArray(content)){
		if(content.length >= 2){ // "or"
			let rootDom = document.createElement('div');
			rootDom.classList = 'wizard choice';
			let selector = document.createElement('select');
			rootDom.appendChild(selector);
			for(let poss of content){
				let option = document.createElement('option');
				option.textContent = JSON.stringify(poss);
				selector.appendChild(option);
			}
			selector.onchange = event => {
				let selector = event.srcElement; let parent = selector.parentNode;
				parent.removeChild(parent.children[1]);
				parent.appendChild(makeWord(JSON.parse(selector.selectedOptions[0].textContent)));
			};
			rootDom.appendChild(makeWord(content[0]));
			return rootDom;
		} else if(content.length == 1){ // literal
			let literal = content[0];
			if(literal == null || typeof literal == 'number' || typeof literal == 'string'){
				let retVal = document.createElement('p'); retVal.textContent = literal; return retVal;
			} else if(Array.isArray(literal)){
				let rootDom = document.createElement('div');
				rootDom.classList = 'wizard literal array list';
				let open = document.createElement('span'); open.classList = 'bracket'; open.textContent = '['; rootDom.appendChild(open);
				let comma;
				if(literal.length == 1){
					// TODO
				} else if(literal.length == 2){
					let length = literal[1];
					if(typeof length != 'number') throw new Error('Expected second element of array to be a number');
					for(let i = 0; i<length; i++){
						rootDom.appendChild(makeWord(literal[0]));
						comma = document.createElement('span'); comma.textContent = ','; rootDom.appendChild(comma);
					}
				} else {
					throw 'Syntax error: array literal must be either [ ELEMENT_TYPE ] or [ ELEMENT_TYPE, ARRAY_LENGTH ]';
				}
				comma.textContent = ']'; comma.classList = 'bracket';
				return rootDom;
			} else if(typeof literal == 'object'){
				let rootDom = document.createElement('div');
				rootDom.classList = 'wizard literal array associative';
				let open = document.createElement('span'); open.classList = 'bracket'; open.textContent = '{'; rootDom.appendChild(open);
				let comma;
				console.log(literal);
				for(let key in literal){
					console.log(key, literal[key]);
					let keyValuePairDom = document.createElement('div');
					let name = document.createElement('span'); name.textContent = key + ":"; keyValuePairDom.appendChild(name);
					keyValuePairDom.appendChild(makeWord(literal[key]));
					rootDom.appendChild(keyValuePairDom);
					comma = document.createElement('span'); comma.textContent = ','; rootDom.appendChild(comma);
				}
				comma.textContent = '}'; comma.classList = 'bracket';
				return rootDom;
			}
		} else {
			throw new Error('Literal [] matches nothing');
		}
	} else if(typeof content === 'object'){
		throw new Error('Literal dicts should be enclosed in lists - this one isn\'t: ' + JSON.stringify(content));
	}
}

function enwizen(grammar){
	completeGrammar = grammar;
	return makeWord(grammar.root);
}
