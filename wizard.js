var schemaDatabase = {
	allKnownSchemas: {},
	addToDatabase: function(schema) {
		console.log("Adding", schema.$id, "to database");
		this.allKnownSchemas[schema.$id] = schema;
	},
	resolve: function(ref, currentId) {
		assert(currentId !== undefined, 'Missing currentId');
		let address, fragment;
		if(ref.includes('#')){ [address, fragment] = ref.split('#'); }
		else [address, fragment] = [ ref, undefined ];
		address = address || currentId;
		assert(address in this.allKnownSchemas, 'Address not known:', address);
		let schema = this.allKnownSchemas[address];
		if(fragment){
			assert(fragment[0] == '/'); fragment = fragment.substring(1);
			for(let ptr of fragment.split('/')){
				schema = schema[ptr];
			}
		}
		return schema;
	}
};

function assert(truth, message, data){
	if(data === undefined) data = '';
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
				assert(elem.firstElementChild.type == 'checkbox', 'Expected checkbox' );
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
	else if(rootDom.classList.contains('enum')) {
		assert(rootDom.nodeName === 'SELECT');
		return JSON.parse(rootDom.value);
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
	keyValuePairDom.appendChild(makeWord(value));
	return keyValuePairDom;
}

function nameForObject(object){
	return JSON.stringify(object);
}

function makeWord(content, currentId){
	if(currentId === undefined){
		currentId = content.$id;
		schemaDatabase.addToDatabase(content);
	}

	console.log('Making word from schema', content, 'with ID', currentId);
	assert(typeof content === 'object' && content !== null, 'Schema should be an object, is', content);

	if(content.$ref){
		const resolvedContent = schemaDatabase.resolve(content.$ref, currentId);
		return makeWord(resolvedContent, currentId);
	}
	else if(content.const) {
		let retVal = document.createElement('p'); retVal.classList = 'spell literal'; retVal.textContent = JSON.stringify(content.const); return retVal;
	}
	else if(content.enum) {
		let selector = document.createElement('select');
		selector.classList = 'spell enum';
		for(let value of content.enum){
			let option = document.createElement('option');
			option.textContent = JSON.stringify(value);
			selector.appendChild(option);
		}
		return selector;
	}
	else if(content.oneOf) {
		let rootDom = document.createElement('div');
		rootDom.classList = 'spell choice';
		let selector = document.createElement('select');
		rootDom.appendChild(selector);
		for(let poss of content.oneOf){
			let option = document.createElement('option');
			option.textContent = nameForObject(poss);
			selector.appendChild(option);
		}
		selector.onchange = event => {
			let selector = event.target; let parent = selector.parentNode;
			parent.removeChild(parent.children[1]);
			parent.appendChild(makeWord(JSON.parse(selector.selectedOptions[0].textContent), currentId));
		};
		rootDom.appendChild(makeWord(content.oneOf[0], currentId));
		return rootDom;
	}
	else if(content.type){
		if(['integer', 'string'].includes(content.type)){
			let inputDom = document.createElement('input');
			inputDom.classList.add('spell', 'input');
			if(content.type == 'integer'){
				inputDom.type = 'number';
				if(content.minimum) {
					inputDom.min = content.minimum;
				}
				if(content.maximum) {
					inputDom.max = content.maximum;
				}
			}
			else if(content.type == 'string'){
			}
			return inputDom;
		}
		else if(content.type == 'array'){
			console.log('Handling array');
			let rootDom = document.createElement('div');
			rootDom.classList = 'spell array list';

			if(content.prefixItems){
				for(let item of content.prefixItems){
					rootDom.appendChild(makeWord(item, currentId));
				}
			}
			function deleteItemHandler(event){ let x = event.target; x.parentNode.parentNode.removeChild(x.parentNode); }
			// using rootDom as an argument so the external rootDom is not in the function closure. If the function has no closure, it can be reused between invocations
			// tl;dr: this is a useless and premature optimization
			function newItem(schema){
				let div = document.createElement('div');
				let newElement = makeWord(schema, currentId);
				let deleteElementButton = document.createElement('button'); deleteElementButton.textContent = 'x'; deleteElementButton.classList = 'closeButton';
				deleteElementButton.onclick = deleteItemHandler;
				div.appendChild(newElement); div.appendChild(deleteElementButton);
				return div;
			}
			if(content.items !== false){ // if false: do not allow additional items
				let itemSpec = content.items || {}; // if undefined: allow additional items without validation ({} is matched by everything)

				while(rootDom.childElementCount < content.minItems){
					rootDom.appendChild( newItem(itemSpec) );
				}

				let plusButton = document.createElement('button'); plusButton.textContent = '+'; plusButton.classList = 'plusButton';
				rootDom.append(plusButton);
				plusButton.onclick = event => { let rootDom = event.target.parentNode; rootDom.insertBefore( newItem(itemSpec), plusButton); }
			}

			return rootDom;
		}
		else if(content.type == "object"){
			let rootDom = document.createElement('div');
			rootDom.classList = 'spell array associative';

			let required = content.required || [];
			for(let key in content.properties){
				if(required.includes(key)){
					rootDom.appendChild(addKeyValuePair(key, content.properties[key]));
				} else {
					let intermediate = document.createElement('div'); intermediate.classList.add('spell', 'optional', 'not-selected');
					let checkbox = document.createElement('input'); checkbox.type = 'checkbox';
					checkbox.onchange = (event) => {
						let parent = event.target.parentNode;
						let grammarHolder = parent.children[2];
						if(event.target.checked){
							parent.children[1].insertBefore(makeWord(JSON.parse(grammarHolder.textContent), currentId), parent.children[1].children[1]);
							event.target.parentNode.classList.remove('not-selected');
						} else {
							parent.children[1].removeChild(parent.children[1].children[1]);
							event.target.parentNode.classList.add('not-selected');
						}
					}
					intermediate.appendChild(checkbox);

					let keyValuePairDom = document.createElement('div');
					keyValuePairDom.classList = 'spell keyValuePair';
					let name = document.createElement('span'); name.textContent = key; keyValuePairDom.appendChild(name);
					intermediate.appendChild(keyValuePairDom);

					let rawData = document.createElement('span'); rawData.textContent = JSON.stringify(content.optional[key]); rawData.style.display = 'none';
					intermediate.appendChild(rawData);

					rootDom.appendChild(intermediate);
				}
			}

			return rootDom;
		}
		else throw new Error('Unrecognized object type: ' + content.type);
	}
	else {
		throw new Error('Not implemented: object with keys' + Object.keys(content));
	}
}
