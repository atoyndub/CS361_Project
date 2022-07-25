const webPort = 3000;
let express = require('express');
let app = express();
app.set('port', webPort);

//set up body parser to support parsing request body of POST requests
let bp = require('body-parser');
app.use(bp.json({extended:false})); //set up body parser to read json in post requests

const servicePort = 7077; //must match the port number being used by RGBRandomizer.py
const zmq = require('zeromq');

const resourcePath = __dirname + "/resources/";

//send index.html
app.get('/', function(req,res,next)
{
	res.sendFile(resourcePath + "index.html", function(err) //--dirname is the path of the current directory
  {
    if (!err)
      console.log("processed request for index.html successfully");
    else
      console.error(err.stack);
  });
});


//call rand color microservice
app.post('/rand_rgb', function(req,res,next)
{
  //adapted from https://zeromq.org/languages/nodejs/
  //establish socket connection with the microservice as a "req" type
  let serviceSocket = zmq.socket("req");
  serviceSocket.connect("tcp://localhost:" + servicePort);

  //console.log("SERVER: request body is: " + JSON.stringify(req.body)); //testing

  let clientRequestStr = JSON.stringify(req.body);
  serviceSocket.send(clientRequestStr); //send the request (the POST request from the client is expected to already be in correct format for sending to the microservice)

  serviceSocket.on("message", function(serviceResponse) //callback on receipt of the response???
  {
    console.log("SERVER: received response from RGBRandomizer service:\n" + serviceResponse.toString());
    res.send(serviceResponse.toString()); //send the json object w/ new random colors back to the client
  });
});


//send index.js
app.get('/index.js', function(req,res,next)
{
	res.sendFile(resourcePath + "index.js", function(err) //--dirname is the path of the current directory
  {
    if (!err)
      console.log("processed request for index.js successfully");
    else
      console.error(err.stack);
  });
});

//send style.css
app.get('/style.css', function(req,res,next)
{
	res.sendFile(resourcePath + "style.css", function(err) //--dirname is the path of the current directory
  {
    if (!err)
      console.log("processed request for style.css successfully");
    else
      console.error(err.stack);
  });
});

app.use(function(req,res){
  res.status(404);
  res.send('404');
});

app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500);
  res.send('500');
});

app.listen(app.get('port'), function(){
  console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
});



