var app = {}
	, debug = this.queryStr.debug || true
	, config = {
		"type":"update"
		, "sb": {
			"server": this.queryStr.server || "sandbox.spacebrew.cc"
			, "port": this.queryStr.port || 9000
			, "name": this.queryStr.name || "tweet_sender"
			, "description": unescape(this.queryStr.description) || "web app that forwards tweets to spacebrew"
			, "pubs": [
				{ 
					"name": 'tweeted', 
					"type": 'string' 
				} 
			]
			, "subs": [
				{ 
					"name": 'tweet', 
					"type": 'string' 
				} 
			]
		}
		, "web": {
			"input": {
				"required": {
					"tweet": {
						"update": "string"
					}
				}
			}
			, "output": {
				"tweet": {
					"tweet": ""				
					, "created_at": ""
				}
			}
		}
		, "query_path" : "/tweet/update"
	};

/**
 * sbFunctions Constructor for the object that holds the spacebrew callback methods that will be registered
 * 			   with the controller via the addCallback method.
 */
function sbFunctions () {

	/**
	 * Callback method that is called to send information about an individual tweet via spacebrew.
	 * This is where this mapping can be customized.
	 * 
	 * @param  {Object} curTweet Current tweet object
	 * @param  {Object} pubs     Information about all publication channels
	 * @param  {Object} sb       Link to spacbrew object
	 */
	function sbLoadTweet(curTweet, pubs, sb) {
		var vals = []
			;
		console.log( "[sbLoadTweet] current pub: " + curTweet + " pubs: ", pubs);

		// set the values for each publication feed
		vals = [
			unescape(curTweet.text)			// tweets
		];				

		for (var j in pubs) {							
			if (vals[j]) {
				if (debug) console.log( "[sbLoadTweet] current pub: " + j + " name: " + pubs[j].name +
										"sending value: " + vals[pubs[j].name]);
				sb.send( pubs[j].name, pubs[j].type, vals[j] );		
			}
		}				    	
	}	

	/**
	 * Callback method used to handle string messages from Spacebrew.
	 * 
	 * @param  {String} name  	Name of the subscription channel
	 * @param  {String} value 	Text of the message that was sent
	 */
	function onString(name, value) {
		// prep query string to submit to twitter
		if (name === 'tweet') {
			var msg = {
				"required": {
					"tweet": {
						"update" : value
						, "available": true
					}
				}
			}
			app.control.submit(msg);		
			if (debug) console.log("[onString] submitted tweet received via spacebrew ", msg);
		}
	}
}


$(window).bind("load", function() {
	var sb = new sbFunctions();

	if (!authConfirm) {
		$("#logIn").on("click", function(event) {
			$(location).attr('href', ("/tweet/auth?client_id=" + clientId));
		});
		if (debug) console.log("[onload:window] registered logIn button")
	} 

	else {
		app.model = new Model.Main(clientId, config);
		app.web_view = new View.Web({"model": app.model});
		app.sb_view = new View.Spacebrew({"model": app.model});
		app.sb_view.addCallback("load", "sbLoadTweet", sb);
		app.sb_view.addCallback("onString", "onString", sb);
		app.control = new Control.Main([app.web_view, app.sb_view], app.model);
		if (debug) console.log("[onload:window] loaded model, controllers, and views")
	}
});