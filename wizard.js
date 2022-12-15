var content = undefined;

var completeGrammar = undefined;

function assert(truth, message, data){
	if(! truth) throw new Error(message + data);
}

function readWord(rootDom){
	console.log(rootDom);
	assert(rootDom.classList.contains('spell'), 'rootDom is not a Spell dom element');
	if(rootDom.classList.contains('literal')){
		return JSON.parse(rootDom.textContent);
	}
	else if(rootDom.classList.contains('list')){
		let children = [...rootDom.children];
		return children
			.filter(elem => elem.classList.contains('spell'))
			.map(readWord);
	}
	else if(rootDom.classList.contains('associative')){
		let retVal = {};
		for(let elem of rootDom.children) if(elem.classList.contains('spell')){
			let true_elem = elem;
			if(elem.classList.contains('optional')){
				assert(elem.firstElementChild.type == 'checkbox' );
				if(!elem.firstElementChild.checked) continue;
				else true_elem = elem.childNodes[1];
			}
			assert(true_elem.classList.contains('keyValuePair'));
			let key = true_elem.children[0].textContent;
			let value = readWord(true_elem.children[1]);
			retVal[key] = value;
		}
		return retVal;
	}
	else if(rootDom.classList.contains('choice')) {
		assert(rootDom.children.length === 2);
		assert(rootDom.children[0].nodeName === "SELECT");
		return readWord(rootDom.children[1]);
	}
	else if(rootDom.classList.contains('input')) {
		let val = rootDom.value;
		if(rootDom.type === 'number'){
			let retVal = Number.parseFloat(val);
			if(isNaN(retVal)) throw new Error('Please enter a valid value!');
			return Number.parseFloat(val);
		}
		else return val;
	}
	else {
		throw new Error('Unrecognized rootDom' + rootDom);
	}
}

function addKeyValuePair(key, value){
	let keyValuePairDom = document.createElement('div');
	keyValuePairDom.classList = 'spell keyValuePair';
	let name = document.createElement('span'); name.textContent = key; keyValuePairDom.appendChild(name);
	keyValuePairDom.appendChild(_makeWord(value));
	return keyValuePairDom;
}

function _makeWord(content){
	if(content == null){
		throw new Error('Literal null matches nothing');
	}
	else if(typeof content === 'number'){
		throw new Error('Number literal matches nothing: ' + content);
	}
	else if(typeof content === 'string'){
		if(content === 'integer'){
			let inputDom = document.createElement('input');
			inputDom.classList.add('spell', 'input');
			inputDom.type = 'number';
			return inputDom;
		}
		else if(!completeGrammar.hasOwnProperty(content)) throw new Error('Varname ' + content + ' not found');
		else return _makeWord(completeGrammar[content]);
	}
	else if(Array.isArray(content)){
		if(content.length >= 2){ // "or"
			let rootDom = document.createElement('div');
			rootDom.classList = 'spell choice';
			let selector = document.createElement('select');
			rootDom.appendChild(selector);
			for(let poss of content){
				let option = document.createElement('option');
				option.textContent = JSON.stringify(poss);
				selector.appendChild(option);
			}
			selector.onchange = event => {
				let selector = event.target; let parent = selector.parentNode;
				parent.removeChild(parent.children[1]);
				parent.appendChild(_makeWord(JSON.parse(selector.selectedOptions[0].textContent)));
			};
			rootDom.appendChild(_makeWord(content[0]));
			return rootDom;
		}
		else if(content.length == 1){ // literal
			let literal = content[0];
			if(literal == null || typeof literal == 'number' || typeof literal == 'string'){
				let retVal = document.createElement('p'); retVal.classList = 'spell literal'; retVal.textContent = JSON.stringify(literal); return retVal;
			}
			else if(Array.isArray(literal)){
				let rootDom = document.createElement('div');
				rootDom.classList = 'spell array list';
				let open = document.createElement('span'); open.classList = 'bracket'; open.textContent = '['; rootDom.appendChild(open);
				let comma;
				if(literal.length == 1){
					// TODO
				} else if(literal.length == 2){
					let length = literal[1];
					if(typeof length != 'number') throw new Error('Expected second element of array to be a number');
					for(let i = 0; i<length; i++){
						rootDom.appendChild(_makeWord(literal[0]));
						comma = document.createElement('span'); comma.textContent = ','; rootDom.appendChild(comma);
					}
				} else {
					throw 'Syntax error: array literal must be either [ ELEMENT_TYPE ] or [ ELEMENT_TYPE, ARRAY_LENGTH ]';
				}
				comma.textContent = ']'; comma.classList = 'bracket';
				return rootDom;
			}
			else if(typeof literal == 'object'){
				let rootDom = document.createElement('div');
				rootDom.classList = 'spell array associative';
				let open = document.createElement('span'); open.classList = 'bracket'; open.textContent = '{'; rootDom.appendChild(open);
				let comma;
				for(let key in literal){
					rootDom.appendChild(addKeyValuePair(key, literal[key]));
					comma = document.createElement('span'); comma.textContent = ','; rootDom.appendChild(comma);
				}
				comma.textContent = '}'; comma.classList = 'bracket';
				return rootDom;
			}
		} else {
			throw new Error('Literal [] matches nothing');
		}
	}
	else if(typeof content === 'object'){
		assert(content["required"] && content["optional"], "Class-object does not contain 'required' and 'optional'");
		let rootDom = document.createElement('div');
		rootDom.classList = 'spell array associative';
		let open = document.createElement('span'); open.classList = 'bracket'; open.textContent = '{'; rootDom.appendChild(open);
		let comma;
		for(let key in content.required){
			rootDom.appendChild(addKeyValuePair(key, content.required[key]));
			comma = document.createElement('span'); comma.textContent = ','; rootDom.appendChild(comma);
		}
		for(let key in content.optional){
			let intermediate = document.createElement('div'); intermediate.classList.add('spell', 'optional', 'not-selected');
			let checkbox = document.createElement('input'); checkbox.type = 'checkbox';
			checkbox.onchange = (event) => {
				if(event.target.checked) event.target.parentNode.classList.remove('not-selected');
				else event.target.parentNode.classList.add('not-selected');
			}
			intermediate.appendChild(checkbox);
			intermediate.appendChild(addKeyValuePair(key, content.optional[key]));
			rootDom.appendChild(intermediate);
			comma = document.createElement('span'); comma.textContent = ','; rootDom.appendChild(comma);
		}
		comma.textContent = '}'; comma.classList = 'bracket';
		return rootDom;
	}
	else {
		console.warn(content);
		throw new Error('Object not recognized by grammar');
	}
}

function makeWord(grammar){
	completeGrammar = grammar;
	return _makeWord(grammar.root);
}
