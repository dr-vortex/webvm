# WebVM

WebVM is a virtual machine (VM) implementation in Javascript.  It allows you to simulate hardware, in a web environment. You could (with some effort), run Windows or Linux on WebVM.

### Arcive Note

WebVM is discontinued due to lack of support and significanty better pre-existing emulators.

## Documentation

#### Creating, starting, and stopping a VM

A WebVM can be created by instantiating the `WebVM` class:
```js
const myVM = new WebVM();

```
This should not be used directly, as the library uses [IndexedDB](https://developer.mozilla.org/Web/API/IndexedDB_API) to store data. Instead, you should wrap and VM creation around the WebVM.ready promise:
```js
let myVM;
WebVM.ready.then(idb => {
	myVM = new WebVM({storage: 2**16});
});

```
Creating a VM automatically creates all of its components except storage. By adding a `storage` property to the options, it will also create a storage. You can also change the memory size (`memory`) and the CPU bitage (`cpu`). For example:
```js
let myVM;
webVM.ready.then(() => {
	myVM = new WebVM({
		storage: 2**24, //16.7 MB
		ram: 2**20, //1 MB
		cpu: 32
	});
});
```
The CPU defaults to 64-bit and the Memory defaults to 65KB.

A VM can be started or stopped using its `start` and `stop` methods.
```
myVM.start();
myVM.stop();
```



#### Storage

Storage can be created along with a VM, or seperatly with its class. Storage is saved locally, and persists after page reloads. After creating a storage, it is important to save the id! WebVM does not save the ids of storages, so you must save them yourself. A saved storage can be loaded using `WebVM.Storage.load`.
```js
localStorage.vmStorages ??= [];
if(localStorage.vmStorages.length > 0){

	let myVM = new WebVM();
	
	localStorage.vmStorages.forEach(storage => {
		
		WebVM.Storage.load(storage, myVM);
		
	});

}else{
	let myVM = new WebVM();

	let myStorage = new WebVM.Storage(2**24);
	
	localStorage.vmStorages.push(myStorage.id);
}

```

#### Memory (RAM)

Memory or RAM is not saved accross pages and reloads. You can also create it seperatly. The class is aliased as `RAM` for convience.
```js
let myRAM = new WebVM.Memory(2**16);

let myOtherRAM = new WebVM.RAM(2**16);

myVM.memory.push(myRAM, myOtherRAM);

```

#### Processor (CPU)

VMs can only have one processor or CPU, unlike the other components. The CPU is used to actually run programs and such. The class is aliased as `CPU`. Once again, you can create it seperatly, though it will not function without memory. The CPU is automatically created with VMs, defaulting to 64-bit.

The CPU can be used to compile and run jAssembly (JASM) instructions.

```js
let myVM = new WebVM(),
cpu = myVM.cpu,
instructions;

let machineCode = cpu.compile(instructions);

cpu.run(machineCode);

```

Instructions have not been fully implemented yet!

##### jAssembly (JASM)

jAssembly is an assembly language for WebVM. Based on the x86 instruction set, JASM is a mix between Intel and AT&T syntax. The first operand is the source, while the last is the destination. Results are always stored in the last operand. Constants should not be prefixed, registers should be prefixed with a `%` and memory/RAM addresses should be prefixed with `$`. JASM does not currently support memory address destructuring from registers.

```
; comment
mov 0x12 %ah ;print char from al to screen, I think
mov 61 %al ;"="
int 0x10 ;video stuff
mov 41 $1 ;you can change the mood by changing whats in memory at location 1
mov $1 %al
int 0x10 ;video stuff
```
The above program would print "=)" to the screen in teletypewritter (TTY) mode.
#### Display

Displays are used to interact with the VM. Displays are created from HTML Canvas elements. Displays can (and should) be created along with VMs using the options `display` property. If a display is not provided, the first canvas available will be provided.
```js
let myVM = new WebVM({

	display: document.querySelector('canvas#my-vm-screen')

});
```

### Licence

Copyright 2022 Dr. Vortex

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, and/or distribute copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

