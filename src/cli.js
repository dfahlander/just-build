const {main} = require ('./index');
const clr = require ('./console-colors');

main(process.argv).then(()=>{
    process.exit(0);
}).catch(err => {
    console.error(`${clr.RED}${err}${clr.RESET}`);
    process.exit(1);
});
