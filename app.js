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
	var escapedCity = location.city.replace(/\s+/g,"_");
	
	var url = null;
	if(location.country) {
		var escapedCountry = location.country.replace(/\s+/g,"_");
		url = ['/api/e103c87589ef37c6/conditions/lang:FR/conditions/q/', escapedCountry, '/', escapedCity, '.json'].join('');
	} else {
		url = `/api/e103c87589ef37c6/conditions/lang:FR/q/${escapedCity}.json`;
	}

    console.log(url);
    wundergroundClient.get(url, (err, req, res, obj) => {
        console.log(obj);
        var observation = obj.current_observation;
        var results = obj.response.results;
        if (observation) {
            callback(`${observation.weather} et ${observation.temp_c} degré(s) à ${observation.display_location.full}.`, true);
        } else if (results) {
        	var cityName = location.city.charAt(0).toUpperCase() + location.city.substring(1).toLowerCase();
            callback(`Il y a plusieurs villes nommées "${location.city}".`, false);
        } else {
            callback("Désolé, je n'ai pas pu récupérer le temps.", true);
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
var model = 'https://api.projectoxford.ai/luis/v1/application?id=8cffad28-4fbe-44b2-b7ea-f888fadbf230&subscription-key=d2f947cac77b40759199c61ca6d684ae';
var recognizer = new builder.LuisRecognizer(model);
var dialog = new builder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/', dialog);

var welcomeMessage = "Bonjour :)"
 + "  \nJe suis capable de vous dire le temps qu'il fait en ce moment..." 
 + "  \nEssayez d'écrire:\n * Météo\n * Quel temps fait-il ?\n * Quel temps fait-il à Aubervilliers ?"
 + "  \n * Quel temps fait-il à Paris en France ?";
dialog.matches('Welcome', builder.DialogAction.send(welcomeMessage));

dialog.matches('check_weather', [
    (session, args, next) => {
        var locationCity = builder.EntityRecognizer.findEntity(args.entities, 'city');
        var locationCountry = builder.EntityRecognizer.findEntity(args.entities, 'country');
        if (locationCity && locationCountry) {
            return next({ city: locationCity.entity, country: locationCountry.entity });
        } else if (locationCity) {
        	session.dialogData.locationCity = locationCity.entity;
            return next({ city: locationCity.entity});
        } else {
            builder.Prompts.text(session, 'Dans quelle ville ?');
        }
    },
    (session, results, next) => {
    	if(results.response) {
    		results.city = results.response;
    		session.dialogData.locationCity = results.response;
    	}

    	getCurrentWeather(results, (responseString, found) => {
    		console.log(found);
            session.send(responseString);
            if(found) {
            	session.endDialog();
            } else {
            	console.log("I'm HEEERREEE");
            	builder.Prompts.text(session, 'Pouvez-vous préciser le pays ?');
            }
        });
    },
    (session, results) => {
    	results.city = session.dialogData.locationCity;
    	if(results.response) {
    		results.country = results.response;
    	}
    	getCurrentWeather(results, (responseString, found) => {
    		if(!found) {
    			session.send("Désolé, je n'ai pas réussi à trouver cette ville.");
    		} else {
            	session.send(responseString);
            }
        })
    }

]);

dialog.onDefault(builder.DialogAction.send("Je suis désolé, je n'ai pas compris. Je suis seulement capable de donner le temps d'une ville en ce moment."));





