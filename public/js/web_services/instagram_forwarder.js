var app = {}
	, clientId = clientId || -1
	, queryStr = queryStr || {}
	, authConfirm = authConfirm || false
	, debug = this.queryStr.debug || true
	, config = {
		"type": "forward"
		, "sb": {
			"server": this.queryStr.server || "sandbox.spacebrew.cc"
			, "port": this.queryStr.port || 9000
			, "name": this.queryStr.name || "twitter_forwarder"
			, "description": unescape(this.queryStr.description) || "web app that forwards tweets to spacebrew"
			, "pubs": [
				{
					"name": "photo"
					, "type": "string"
				}
				, {
					"name": "user_photo"
					, "type": "string"
				}
				, {
					"name": "user_photo_location"
					, "type": "string"
				}
				, {
					"name": "user_photo_text"
					, "type": "string"
				}
				, {
					"name": "kitchen_sink"
					, "type": "string"
				}
				, {
					"name": "new_data"
					, "type": "boolean"
				}			
			]
			, "subs": [
				{
					"name": "tag"
					, "type": "string"
				}
				, {
					"name": "stop"
					, "type": "boolean"
				}
			]
		}
		, "web": {
			"input": {
				"required": {
					"query": {
						"text": "string"
					}
				}
			}
			, "output": {
				"post": {
					"user": ""
					, "profile_pic": "img"
					, "photo": "img"
					, "lat": ""
					, "long": ""
					, "text": ""
					, "id": ""
				}
			}
		}
		, "query_path" : "/instagram/search"
	};


/**
 * sbFunctions Constructor for the object that holds the spacebrew callback methods that will be registered
 * 			   with the controller via the addCallback method.
 */
function sbFunctions () {

	/**
	 * sbLoadTweet Callback method that is called to send information about an individual entry via spacebrew.
	 * 			   This is where this mapping can be customized.
	 * @param  {Object} data 	Current data object
	 * @param  {Object} pubs 	Information about all publication channels
	 * @param  {Object} sb   	Link to spacbrew object
	 */
	this.sbLoad = function(data, pubs, sb) {
		var photo = data.photo
			user_photo = JSON.stringify({"user": data.name, "photo": data.photo})
			, user_photo_location = JSON.stringify({"user": data.name, "photo": data.photo, "lat": data.lat, "long": data.long})
			, user_photo_text = JSON.stringify({"user": data.name, "photo": data.photo, "text": unescape(data.text)})
			, kitchen_sink = JSON.stringify(data)
			, vals = []
			;

		if (data.lat && data.long) {
			if (data.lat != "not available" && data.long != "not available") {
				users_tweets_geo = JSON.stringify({"user": data.name, "tweet": data.text, "lat": data.lat, "long": data.long});		
			}			
		}

		// set the values for each publication feed
		vals = [
			photo					
			, user_photo 					
			, user_photo_location			
			, user_photo_text				
			, kitchen_sink					
			, "true"						
		];				

		for (var j in pubs) {							
			if (vals[j]) {
				if (debug) console.log("[sbLoad] current pub: " + pubs[j].name + " sending: " + vals[j]);
				sb.send( pubs[j].name, pubs[j].type, vals[j] );		
			}
		}				    	
	}	

	/**
	 * onString Callback method used to handle string messages from Spacebrew.
	 * @param  {String} name  	Name of the subscription channel
	 * @param  {String} value 	Text of the message that was sent
	 */
	this.onString = function(name, value) {
		
		if (name === "tag") {
			var msg = {
				"required": {
					"query": {
						"text" : value
						, "available": true
					}
				}
			}
			app.control.toggleState(true);
			app.control.submit(msg);
			if (debug) console.log("[onString] submitted tag query received via spacebrew ", msg);			
		}
	}

	this.onBoolean = function(name, value) {
		if (name == "stop") {
			app.control.toggleState(false);
			if (debug) console.log("[onBoolean] turned off forwarding ");
		}
	}
}


$(window).bind("load", function() {
	var sb = new sbFunctions();

	if (!authConfirm) {
		$("#logIn").on("click", function(event) {
			$(location).attr('href', ("/instagram/auth?client_id=" + clientId));
		});
		if (debug) console.log("[onload:window] registered logIn button")
	} 

	else {
		app.model = new Model.Main(clientId, config);
		app.web_view = new View.Web({"model": app.model});
		app.sb_view = new View.Spacebrew({"model": app.model});
		app.sb_view.addCallback("load", "sbLoad", sb);
		app.sb_view.addCallback("onString", "onString", sb);
		app.sb_view.addCallback("onBoolean", "onBoolean", sb);
		app.control = new Control.Main([app.web_view, app.sb_view], app.model);
		if (debug) console.log("[onload:window] loaded model, controllers, and views")
	}
});