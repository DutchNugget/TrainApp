// fastify imported as a factory function. Builds and returns new server instances. 
import Fastify from 'fastify';

// turns on built-in request logging and creates server instance. Every request will be printed to terminal.
// Logs all errors with  no need for logging code later. 
// the app variable is the handle for the whole server. 
const app = Fastify({ logger: true});


// registers a route: any GET request to /health runs this function. 
// async due to real routes needing to wait for database queries etc. Good habit to start. 
app.get ('/health', async () => {
    return { status: 'ok'};
})


// 
const start = async () => {
    try {
        // this line turns it into a running server bound to a network port. 3000 is arbitrary but will be used for CUrl 
        await app.listen ({ port : 3000, host: '0.0.0.0'})
    } catch (err) {
        app.log.error(err);
        process.exit(1)
    }
};

//executes the code
start ();