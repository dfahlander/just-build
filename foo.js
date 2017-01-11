const { Observable } = require ('./bundledExternals/bundle');

var o = new Observable(observer => {
    observer.next(1);
    observer.next(2);
    observer.complete();
});

o.subscribe({
    next (x) {
        console.log(`next: ${x}`);
    },
    complete() {
        console.log(`complete!`);
    }
});

