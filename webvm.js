class WebVM{
	static get version(){
		return '0.1.0'
	}
	static get _generateID(){
		return Math.random().toString(16).slice(2)
	}
	static #resolveReady;
	static #readyPromise = new Promise((resolve, reject) => {
		this.#resolveReady = resolve;
	});
	static get ready(){
		return this.#readyPromise;
	}
	static toSize(size){
		let oom = Math.floor(Math.log10(size) /3);
		return parseFloat((size/10**(oom*3)).toFixed(2)) + ['B', 'KB', 'MB', 'GB', 'TB', 'PB'][oom]
	}
	static fromSize(size){
		let oom = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'].indexOf(size.match(/[KMGTP]?B?$/)[0]);
		return 10**(oom*3);
	}
	static toHex(number, length){
		return ('0'.repeat(length) + number.toString(16).toUpperCase()).slice(-length);
	}
	static fromHex(number){
		return +`0x${number}`
	}
	static toBin(number, length){
		return ('0'.repeat(length) + (+number).toString(2)).slice(-length);
	}
	static fromBin(number){
		return +`0b${number}`
	}
	static {
		const dbRequest = indexedDB.open('WebVM', 1);
		this._db = {};
		dbRequest.onerror = e => {
			console.error('WebVM failed to open IndexedDB');
		}
		dbRequest.onblocked = e => {
			console.error('WebVM was blocked from upgrading DB');
		}
		dbRequest.onupgradeneeded = e => {
			let db = dbRequest.result;
			db.createObjectStore('storage');
		}
		dbRequest.onsuccess = e => {
			this._db = dbRequest.result;
			this.#resolveReady(this._db);
		}

		this.Memory = this.RAM = class extends Uint8ClampedArray{

			constructor(size){
				super(size);
			}
			read(start, end){
				return this.subarray(start, end);
			}
			write(start, data){
				this.set(data, start);
			}
		}
		this.Processor = this.CPU = class{
			static Register = class extends Uint8ClampedArray{
				#bitage;
				#name;
				#appendHL;
				constructor(name, appendHL = false, bitage = 64){
					super(bitage / 8);
					this.#name = name;
					this.#bitage = bitage;
					this.#appendHL = appendHL;
				}
				get _name(){
					return this.#name;
				}
				get bitage(){
					return this.#bitage;
				}
				has(section){
					return new RegExp(`^[re]?${this.#name.slice(0, -1)}[${this.#name.at(-1)}hl]$`).test(section);
				}
				getSection(section){
					return ['r' + this.#name, 'e' + this.#name, this.#name, (this.#appendHL ? this.#name : this.#name.slice(0, -1)) + 'h', (this.#appendHL ? this.#name : this.#name.slice(0, -1)) + 'l'].indexOf(section);
				}
				read(section){
					let copy = Uint8ClampedArray.from(this);
					return  [copy, copy.subarray(-4), copy.subarray(-2), copy.subarray(-2, -1), copy.subarray(-1)][this.getSection(section)];
				}
				write(section, data){
					this.set(
						WebVM.toBin(data, [8, 4, 2, 1, 1][this.getSection(section)]),
						[0, 4, 6, 7, 8][this.getSection(section)]
					)
				}
			}
			static instructions = {
				add: [1, 2],
				mov: [2, 2],
				int: [3, 0],
				jmp: [4, 1],
				push: [5, 1],
				pop: [6, 0]
			}
			instruction = [
				a => null,
				(a, b) => b += a,
				(a, b) => b = a,

			]
			compile(jasm){
				let bin = [];
				jasm.split('\n').map(text => {
					let split = text.split(';')[0].trim().split(/[, ]/);
					let inst = WebVM.Processor.instructions[split[0]];
					split = split.slice(0, inst[1]+1);
					if(inst){
						let operandType = split.slice(1).map(operand => operand[0] == '$' ? 2 : operand[0] == '%' ? 1 : 0);
						bin.push(
							inst[0],
							WebVM.fromBin(WebVM.toBin(inst[1], 4)+WebVM.toBin(operandType[0]??0, 2)+WebVM.toBin(operandType[1]??0, 2)),
						);
						for(let i  = 1; i <= inst[1]; i++){
							bin.push(
								+(operandType[i-1] == 0 ? split[i] : operandType[i-1] == 2 ? split[i].slice(1) : WebVM.fromBin(
									WebVM.toBin(this.registers.findIndex(reg => reg.has(split[i].slice(1))),5)
									+WebVM.toBin(this.registers.find(reg => reg.has(split[i].slice(1))).getSection(split[i].slice(1)), 3)
								))
							);
						}
					}
				});
				return Uint8ClampedArray.from(bin);
			}
			#bitage;
			constructor(bitage, vm){
				this.#bitage = bitage;
				if(vm instanceof WebVM){
					this._vm = vm;
				}
				this.registers = [
					new WebVM.Processor.Register('ax'),
					new WebVM.Processor.Register('bx'),
					new WebVM.Processor.Register('cx'),
					new WebVM.Processor.Register('dx'),
					new WebVM.Processor.Register('sp', true),
					new WebVM.Processor.Register('bp', true),
					new WebVM.Processor.Register('si', true),
					new WebVM.Processor.Register('di', true),
					new WebVM.Processor.Register('ss'),
					new WebVM.Processor.Register('cs'),
					new WebVM.Processor.Register('ds'),
					new WebVM.Processor.Register('es'),
					new WebVM.Processor.Register('fs'),
					new WebVM.Processor.Register('gs'),
					new WebVM.Processor.Register('ip'),
					new WebVM.Processor.Register('flags', true)
				]
			}
			fetch(address){
				return (''+address)[0] == '$' ? this._vm.allMemory[address.slice(1)]:
				(''+address[0]) == '%' ? this.getRegister(address.slice(1)).read(address.slice(1)):
				+address
			}
			run(instructions){
				let i = 0;
				while(i < instructions.length){
					this.getRegister('ip').write('rip', i);
					let argData = WebVM.toBin(instructions[i+1], 8),
					argNum = WebVM.fromBin(argData.slice(0, 4)),
					type = [WebVM.fromBin(argData.slice(-4, -2)), WebVM.fromBin(argData.slice(-2))];
					let args = [
					type[0] == 2 ? this._vm.allMemory[instructions[i+2]] :
					type[0] == 1 ? this.getRegister(instructions[i+2]): 
					instructions[i+2],
					type[1] == 2 ? this._vm.allMemory[instructions[i+3]] :
					type[1] == 1 ? this.getRegister(instructions[i+3]): 
					instructions[i+3]];
					this.instruction[instructions[i]](...args);
					i += 2 + argNum;
				}
			}
			getRegister(name){
				return this.registers.find(reg => reg.has(name));
			}
		}
		this.Storage = class extends Uint8ClampedArray{
			static has(id){
				return new Promise((resolve, reject) => {
					let transaction = WebVM._db.transaction('storage').objectStore('storage').count(id);
					transaction.onsuccess = e => {
						resolve(!!e.target.result);
					}
					transaction.onerror = e => {
						reject();
					}
				})
				
			}
			static load(id, vm){
				return new Promise((resolve, reject) => {
					let transaction = WebVM._db.transaction('storage').objectStore('storage').get(id);
					transaction.onsuccess = e => {
						let storage = new WebVM.Storage(e.target.result, id);
						if(vm instanceof WebVM){
							vm.storage.push(storage);
						}
						resolve(storage);
					};
					transaction.onerror = e => {
						console.warn(`Storage "${id}" does not exist`);
						reject();
					};
				});
			}

			constructor(sizeOrData, id){
				let store = WebVM._db.transaction('storage', 'readwrite').objectStore('storage');
				if(sizeOrData instanceof Uint8ClampedArray && id){
					super(sizeOrData.length)
					this.#id = id;
					this.set(0, sizeOrData);
				}else{
					super(sizeOrData);
					store.put(this, this.#id);
				}
			}

			#id = WebVM._generateID;
			#blockSize = 512;
			get id(){
				return this.#id;
			}
			read(start, end){
				return new Promise((resolve, reject) => {
					let transaction = WebVM._db.transaction('storage').objectStore('storage').get(this.#id);
					transaction.onerror = e => {
						reject(`WebVM failed to open ObjectStore "${this.#id}"`);
					}
					transaction.onsuccess = e => {
						resolve(transaction.result.subarray(start, end));
					}
				});
			}
			write(start, data){
				this.set(data, start);
				WebVM._db.transaction('storage', 'readwrite').objectStore('storage').put(this, this.#id)
			}
			readBlock(address){
				return this.read(address*this.#blockSize, address*this.#blockSize+this.#blockSize);
			}
			writeBlock(address, data){
				this.write(address, data.subarray(0, this.#blockSize));
			}
			remove(){
				WebVM._db.transaction('storage', 'readwrite').objectStore('storage').delete(this.#id);

			}
		}
		this.Display = this.Screen = class{
			static convertColor(color){
				return [
					Math.round((+color >> 5) * 255/7),
					Math.round((+color >> 2 & 0x07) *255/7),
					Math.round((+color & 0x03) * 255/3),
					255
				];
			}
			constructor(canvas, vm){
				if(!(canvas instanceof HTMLCanvasElement)) throw new TypeError('WebVM Display must be created with a canvas');
				this.context = canvas.getContext('2d');
				this.canvas = canvas;
				canvas.width = canvas.clientWidth;
				canvas.height = canvas.clientHeight;
				this.width = canvas.width;
				this.height = canvas.height;
				this.buffer = new Uint8ClampedArray(this.width*this.height);
				if(vm instanceof WebVM){
					this._vm = vm;
				}
			}

			textBuffer = '';
			buffer = new Uint8ClampedArray();
			renderColorTest(){
				this.buffer = this.buffer.map((e,i)=>i*255/(this.width*this.height));
				this.render();
			}
			render(textMode){
				if(textMode){
					this.context.fillStyle = '#000';
					this.context.fillRect(0, 0, this.width, this.height);
					this.context.fillStyle = '#fff';
					this.context.font = '16px monospace';
					this.textBuffer.split('\n').forEach((text, index) => {
						this.context.fillText(text, 0, (index+1)*16);
					});
					
				}else{
					let renderBuffer = new Uint8ClampedArray(4 * this.width * this.height);
					for(let i = 0; i < this.buffer.length*4; i += 4){
						let color = WebVM.Display.convertColor(this.buffer[i/4]);
						renderBuffer.set(color, i);
					}
					let imageData = new ImageData(renderBuffer, this.width, this.height);
					this.context.putImageData(imageData, 0, 0);
				}
				
			}
			outputText(text){
				this.textBuffer += text + '\n';	
				this.render(true);
			}
		}
		this.DeviceInterface = this.DeviceDriver = class{
			#event;
			constructor(type, {event, errors = [], handler}, vm){
				if(vm instanceof WebVM){
					this._vm = vm;
					this.error = errors;
					this.#event = event;
					this.handler = handler;
					this._vm.displays[0].addEventListener(this.#event, this.handler);
				}
			}
			error = [];
			delete(){
				this._vm.displays[0].removeEventListener(this.#event, this.handler);
			}
		}
		
		this.driver = {
			keyboard: {
				init: vm => {
					vm.drivers.register('keyboard', this);
				}
			}
		}
	}

	cpu = null;
	memory = [];
	storage = [];
	displays = [];

	constructor(options){
		Object.assign(this, {
			cpu: new WebVM.Processor(options?.cpu ? options.cpu : 64, this),
			memory: [new WebVM.Memory(options?.memory ? options.memory : 2**16)],
			displays: [new WebVM.Display(options?.display ? options.display : document.querySelector('canvas'), this)],
		});
		if(options?.storage){
			this.storage = [options?.storage instanceof WebVM.Storage ? options?.storage : new WebVM.Storage(options?.storage || 2**24)];
		}
	}

	#BIOS = {
		error: [
			'BIOS Start Failed',
			'CPU not detected or invalid',
			'Memory not detected or invalid',
			'Memory start block invalid',
			'Storage not detected or invalid',
			'No bootable sector found',
			''
		],
		getError: function(code = 0){
			return `Boot Error 0x${WebVM.toHex(code, 2)}: ${this.error[code]}`
		}
	}

	#bootStage = 0;
	/*
		0: Stopped
		1: Starting using start()
		2: Running bootloader
	*/

	#init(loader){
		this.#bootStage = 2;
		this.displays[0].outputText('Booting!');
	}

	start(){
		let fail = code => {
			this.displays[0].outputText(this.#BIOS.getError(code));
			this.#bootStage = 0;
		}
		this.displays[0].outputText('WebVM BIOS prototype\n');
		this.#bootStage = 1;
		if(!(this.cpu instanceof WebVM.Processor)){
			fail(0x1);
		}else if(!(this.memory[0] instanceof WebVM.Memory)){
			fail(0x2);
		}else if(!(this.storage[0] instanceof WebVM.Storage)){
			fail(0x4);
		}else{
			for(let i = 0; i < this.storage.length; i++){
				this.storage[i].readBlock(0).then(block => {
					if(block[510] == 0xaa && block[511] == 0x55){
						this.#init(block);
					}
					if(i == this.storage.length-1 && this.#bootStage != 2){
						fail(0x5);
					}
				});
			}
		}
	}
	stop(){

	}
	get allMemory(){
		return this.memory.reduce((a,c)=>[...a,...c], [])
	}
	toString(){
		return `WebVM {
			${this.cpu.bitage}-bit cpu,
			${WebVM.toSize(this.allMemory.length)} Memory,
			${WebVM.toSize(this.storage.reduce((a, c) => a + c.length, 0))} Storage
		}`
	}
}

/*class WebOS{
	static {
		
	}
	constructor(vm){
		if(!(vm instanceof WebVM)) throw new TypeError('WebOS needs a Web VM!');
	}
}*/