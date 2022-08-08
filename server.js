const webPort = 3000;
let express = require('express');
let app = express();
app.set('port', webPort);

//set up body parser to parsing json POST requests
let bp = require('body-parser');
app.use(bp.json({extended:false}));

const servicePort = 7077; //matches the port number used by RGBRandomizer.py
const zmq = require('zeromq');

//__dirname is the path of the current directory
const resourcePath = __dirname + "/resources/";

//send index.html
app.get('/index.html', function(req,res,next)
{
    res.sendFile(resourcePath + "index.html", function(err)
    {
        if (err)
            console.error(err.stack);
    });
});

//send help.html
app.get('/help.html', function(req,res,next)
{
    res.sendFile(resourcePath + "help.html", function(err)
    {
        if (err)
            console.error(err.stack);
    });
});

//call rand color microservice
//adapted from https://zeromq.org/languages/nodejs/
app.post('/rand_rgb', function(req,res,next)
{
    //establish socket connection with the microservice as a "req" type
    let serviceSocket = zmq.socket("req");
    serviceSocket.connect("tcp://localhost:" + servicePort);

    //send the request (the client's POST body is already formatted for sending to microservice)
    let clientRequestStr = JSON.stringify(req.body);
    serviceSocket.send(clientRequestStr);

    serviceSocket.on("message", function(serviceResponse) //callback on receipt of the response???
    {
        console.log("SERVER: received response from RGBRandomizer service:\n" + serviceResponse.toString());
        res.send(serviceResponse.toString()); //send the json w/ new random colors to the client
    });
});


//send index.js
app.get('/index.js', function(req,res,next)
{
	res.sendFile(resourcePath + "index.js", function(err)
    {
        if (err)
            console.error(err.stack);
    });
});


//send style.css
app.get('/style.css', function(req,res,next)
{
    res.sendFile(resourcePath + "style.css", function(err)
    {
        if (err)
            console.error(err.stack);
    });
});


app.use(function(req,res)
{
    res.status(404);
    res.send('404');
});


app.use(function(err, req, res, next)
{
    console.error(err.stack);
    res.status(500);
    res.send('500');
});


app.listen(app.get('port'), function()
{
    console.log('Express started on http://localhost:'
                + app.get('port') + '; press Ctrl-C to terminate.');
});