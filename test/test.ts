// class Grandparent {
//     constructor(protected commonDependency: string) {
//         // Initialize common setup for parent and child classes.
//     }
// }

// class Parent extends Grandparent {
//     constructor(commonDependency: string, protected parentDependency: string) {
//         super(commonDependency); // Call the grandparent class's constructor.
//         // Initialize setup specific to the parent class.
//     }
// }

// class Child extends Parent {
//     constructor(commonDependency: string, parentDependency: string, private childDependency: string) {
//         super(commonDependency, parentDependency); // Call the parent class's constructor.
//         // Initialize setup specific to the child class.
//     }

//     doSomething() {
//         console.log(`Child class: ${this.commonDependency}, ${this.parentDependency}, ${this.childDependency}`);
//     }
// }

// let service1 = new Service1()
// let service2 = new Service2()
// let service3 = new Service3()

// let child = new Child(service1, service2, service3)

// private passwordConversion(password: string): string {
//     let c1 = password.replace(":", "%3A")
//     let c2 = c1.replace("/", "%2F")
//     let c3 = c2.replace("?", "%3F")
//     let c4 = c3.replace("#", "%23")
//     let c5 = c4.replace("[", "%5B")
//     let c6 = c5.replace("]", "%5D")
//     let final = c6.replace("@", "%40")
//     console.log(final)
//     return final
// }

class EventEmitter {
    private events = {};

    // Register a callback for an event
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = []; // registering the name of the event. Eg: login logout
        }
        this.events[event].push(callback); // registering the callabck. Not executing them immediately but rather waiting for the evnet ot happen
    }

    // Emit an event and execute its callbacks
    emit(event, data) {
        const listeners = this.events[event];
        if (listeners) {
            for (const listener of listeners) {
                listener(data);
            }
        }
    }
}

const emitter = new EventEmitter();

// Define a callback function for the 'Testing' event
function login(args: any) {
    console.log(`Logging in with ${args}`);
}
function logout(args: any) {
    console.log(`Logging out with ${args}`);
}

// Register the 'login' callback for the 'Testing' event
emitter.on('login', login);
emitter.on('logout', logout);
emitter.emit('login', 'Jane');
emitter.emit('logout', `John`);

// sample callbacks
// const personObject = {
//     eatApple: (appleObject) => {
//         appleObject.peelApple()
//         console.log(`eat Apple`)
//     }
// }
// const appleObject = {
//     peelApple: () => {
//         console.log(`Peel Apple`)
//     }
// }

// personObject.eatApple(appleObject)