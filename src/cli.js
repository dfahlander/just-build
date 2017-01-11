const {main} = require ('./index');

main(process.argv).then(()=>{
    process.exit(0);
}).catch(err => {
    console.error(`Error: ${err}`);
    process.exit(1);
});
