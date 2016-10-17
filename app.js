var builder = require('botbuilder');
var restify = require('restify');

//=========================================================
// Server setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Serve a static web page
server.get(/.*/, restify.serveStatic({
	'directory': '.',
	'default': 'index.html'
}));

//=========================================================
// Weather Underground API setup
//=========================================================

var wundergroundClient = restify.createJsonClient({ url: 'http://api.wunderground.com' });
function getCurrentWeather(location, callback) {
    var escapedLocation = location.replace(/\W+/, '_');
    wundergroundClient.get(`/api/e103c87589ef37c6/conditions/lang:FR/q/${escapedLocation}.json`, (err, req, res, obj) => {
        console.log(obj);
        var observation = obj.current_observation;
        var results = obj.response.results;
        if (observation) {
            callback(`It is ${observation.weather} and ${observation.temp_c} degrees in ${observation.display_location.full}.`);
        } else if (results) {
            callback(`There is more than one '${location}'. Can you be more specific?`);
        } else {
            callback("Couldn't retrieve weather.");
        }
    })
}

//=========================================================
// Bot setup
//=========================================================

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//=========================================================
// Bot dialog
//=========================================================
var model = 'https://api.projectoxford.ai/luis/v1/application?id=0355ead1-2d08-4955-ab95-e263766e8392&subscription-key=d2f947cac77b40759199c61ca6d684ae&q=';
var recognizer = new builder.LuisRecognizer(model);
var dialog = new builder.IntentDialog({ recognizers: [recognizer] });
bot.add('/', dialog)

dialog.on('builtin.intent.weather.check_weather', [
    (session, args, next) => {
        var locationEntity = builder.EntityRecognizer.findEntity(args.entities, 'builtin.weather.absolute_location');
        if (locationEntity) {
            return next({ response: locationEntity.entity });
        } else {
            builder.Prompts.text(session, 'Dans quelle ville ?');
        }
    },
    (session, results) => {
    	getCurrentWeather(results.response, (responseString) => {
            session.send(responseString);
        });
    }
]);




