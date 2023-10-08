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