import _ = require("lodash")

export class UtilityService {
    // Check Heap size
    // const v8 = require('v8');
    // const heapStats = v8.getHeapStatistics();
    // const maxHeapSize = heapStats.heap_size_limit / (1024 * 1024); // Convert to MB
    // console.log(`Current maximum heap size: ${maxHeapSize.toFixed(2)} MB`);
    // const used = process.memoryUsage().heapUsed / 1024 / 1024;
    // const total = process.memoryUsage().heapTotal / 1024 / 1024;
    // console.log(`Heap memory usage: ${used.toFixed(2)} MB`);
    // console.log(`Total heap size: ${total.toFixed(2)} MB`);

    public callFromOtherClass() {
        const t0 = performance.now()
        let i
        for (i = 0; i <= 6000000000; i++) {
        }
        const t1 = performance.now()
        const timeTakenInSeconds = (t1 - t0) / 1000;
        console.log(`Time taken: ${timeTakenInSeconds} seconds to run this function`);
    }

    public checkHeapSize(): any {
        let currentHeapSize = process.memoryUsage().heapUsed / 1024 / 1024;
        let allocatedHeapSize = 512;
        let percentage = (currentHeapSize / allocatedHeapSize) * 100;
        console.log(`Consumer_! Heap currentHeapSize: ${currentHeapSize.toFixed(2)} MB. Percentage: ${percentage} %`);

        return percentage
    }

    public checkMaxHeap() {
        let v8 = require('v8');
        let heapStats = v8.getHeapStatistics();
        let maxHeapSize = heapStats.heap_size_limit / (1024 * 1024); // Convert to MB
        console.log(`Current maximum heap size: ${maxHeapSize.toFixed(2)} MB`);
    }

    public checkCPU() {
        let os = require('os')
        let cpuUsage = os.cpus()
        console.log(cpuUsage)
    }
}
