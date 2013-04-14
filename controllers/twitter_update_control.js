module.exports = {
	session: {}                    // link to active temboo session
	, model: {                        // holds app configuration and current state information
		"curClientId": 0
		, "clients": {}
		, "page" : {
			"title": "Tweets in Space"
			, "subtitle": "Send tweets through spacebrew"			
			, "template": {
				"no_auth": "twitter_update_no_auth"
				, "auth": "twitter_update"
			}
		}
		, "forwarding_url": "http://localhost:8002/tweet/auth?client_id="
	}
	, utils: require("./utils")
	, oauth: require("./twitter_oauth")

	/**
	 * Method that initializes the controller object by getting a reference to the
	 *  Temboo session object.
	 * @param  {Object} config  Configuration object that includes the auth settings 
	 *                          and the session object.
	 * @return {Object}         Twitter control object if config object was valid,
	 *                          otherwise it returns an empty object
	 */
	, init: function( config ) {
	    if (config["session"]) {
	        this.session = config["session"];
	        this.handleOAuthRequest = this.oauth.getHandleOAuthRequest( this );
	        this.handleAppRequest = this.utils.getHandleAppRequest( this );
	        console.log("[init:Twitter] successfully configured twitter status update controller")
	        return this;
	    } else {
	        console.log("[init:Twitter] unable to configure twitter status update controller")
	        return {};        
	    }
	}

    /**
     * newClient 	Increments the curClientId and then add a new client to the this.model.clients object, 
     * 				assigning to it the new client id.
     * @param  {Object} config  	Configuration object with an application name
     * @return {this.model.Client}  Returns the client object that was just created
     */
    , newClient: function () {
        this.model.curClientId++;               // update curClientId number
        var clientId = this.model.curClientId;  // assign id number for current client
        this.model.clients[clientId] = {        // initialize the current client object
			"id": clientId
			, "updates": []
			, "reply": undefined
			, "auth": {
				"auth_token_secret": ""
				, "callback_id" : ""
				, "access_token": ""
				, "access_token_secret": ""
				, "oath_started": false
			}
			, "query_str": {
				"server": "sandbox.spacebrew.cc"
				, "port": 9000
				, "name": "space tweets"
				, "description": "forwards tweets to spacebrew"
				, "refresh": undefined
			}
		}
        return this.model.clients[clientId];
    }

	/**
	 * Points to Oauth methods that handles http requests associated to OAuth athentication for the
	 * 	twitter app. It leverages Temboo's OAuth API, in a consistent manner. Look at the 
	 * 	twitter_oath.js file for more details. Method is initialized in init function.
	 */
	, handleOAuthRequest: function(req, res) { 
		console.log ("[handleOAuthRequest] placeholder function is being called") 
	}


	/**
	 * Points to callback function that handles requests for the twitter app. These requests 
	 * 	are parsed to extract the app name from the URL. Look at the utils.js file for more 
	 * 	details and to see the code for this method. Method is initialized in init function.  
	 */
	, handleAppRequest: function(req, res) { 
		console.log ("[handleAppRequest] placeholder function is being called") 
	}

    /**
     * Callback function that handles ajax requests for making tweets. The query string 
     *  in the URL for each request includes a client id and the tweet. 
     * 	A reply callback method is added to the client object. This method 
     * 	is used by the tweetTemboo function to respond to the ajax request once 
     * 	it receives a response from the twitter server.
     *        
     * @param  {Request Object} req 	Express server request object, which includes information about 
     *                          		the HTTP request
     * @param  {Response Object} res 	Express server response object, used to respond to the HTTP request
     */
    , handleStatusUpdate: function (req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            , queryJson = JSON.parse(unescape(urlReq.search.replace(/\?/, "")))      // convert string to json (unescape to convert string format first)
            // , client                                       // will hold client object
            , update = ""
            ;


        console.log("[handleStatusUpdate] json update ", queryJson)

        // if no client id is provided, or client id is invalid, then send user back to unauthorized page
        if (!queryJson.id || !this.model.clients[queryJson.id]) {
            res.redirect( "/tweet"); 
        } 

        // make sure that the required query attributes are included in request
        if (queryJson.data.required) {
			for (var attr in queryJson.data.required) {
				if (!queryJson.data.required[attr].available) {
					console.log("[handleQueryRequest] required attribute " + queryJson.data.required[attr] + " not available");
					return;
				}
			}
		}

		update = queryJson.data.required.tweet.update;
		if (update > 140) {
			update = update.substring(0, 140);
		}
		console.log("[handleQueryRequest] update text ", queryJson.data.required.tweet);
		console.log("[handleQueryRequest] update text ", update);

        this.model.clients[queryJson.id].updates.push(update);

        // create the callback function to respond to request once data has been received from twitter
        this.model.clients[queryJson.id].reply = function(data) {
            console.log("[handleStatusUpdate] callback method: ", data);
            res.end(data);                
        }

        // submit the query and client id to the query twitter app
        this.updateTemboo(queryJson.id, "reply");
    }

    /**
     * Submits tweets to twitter via the Temboo API engine. 
     * @param  {Integer} clientId     	Id of the client that submitted this query
     * @param  {String} callbackName 	Name of callback method that should be called when results data
     *                                	is received. If none is proved then it will default to reply.
     */
	, updateTemboo: function (clientId, callbackName) {
        var tweet = this.model.clients[clientId].updates[this.model.clients[clientId].updates.length-1]
            , callbackName = callbackName || "reply"
            , self = this
        	, Twitter = require("temboo/Library/Twitter/Tweets")
			, queryChoreo = new Twitter.StatusesUpdate(self.session)
			, queryInputs = queryChoreo.newInputSet()
            ;

        // abort search if query (held in searchT) is not a valid string
        if (!this.utils.isString(tweet)) {
	        console.log("[updateTemboo] tweet not valid: ", tweet);
	        return;    // return if search term not valid
	    }

        console.log("[updateTemboo] new to be made made: ", tweet);

        // prepare the query by adding authentication elements
		queryInputs.setCredential("TwitterSpacebrewForwarderConsumerKeySecret");
		queryInputs.set_AccessToken(this.model.clients[clientId].auth.access_token);
		queryInputs.set_AccessTokenSecret(this.model.clients[clientId].auth.access_token_secret);

		// configure query with search term and other info
        queryInputs.set_StatusUpdate(tweet);             // setting the search query    
 
        /**
         * Method that is called by the temboo API when the results from 
         *  twitter are returned. It process the data and calls the client's 
         *  handler method to forward the data back to the front end
         *  
         * @param {Temboo Results Obect} results 	Results from Temboo Twitter service query
         */
        var successCallback = function( results ) {
            var tResults = JSON.parse(results.get_Response())
            	, results_list = []
            	;

            // if the response includes the tweet that was sent then create an Object with it
            if (tResults.text) {
				console.log( "[successCallback:updateTemboo] tweeted successfully: ", tResults.text );
				newTweet = { 
					"tweet" : tResults.text 
				};
			}

			// add the results to an array object
			results_list.push(newTweet)

			// send the array under the attribute "list"
			if (self.model.clients[clientId][callbackName]) {
				var reply_obj = { "list" : results_list};
				self.model.clients[clientId][callbackName](JSON.stringify(reply_obj));
			}
		};

        // Run the choreo, passing the success and error callback handlers
        queryChoreo.execute(
            queryInputs,
            successCallback,
            function(error) {console.log(error.type); console.log(error.message);}
        );
    }

    /**
     * isString 	Check whether an object is a string
     * @param  {Object}  obj 	Object that will be checked to confirm whether it is a string
     * @return {Boolean}     	Returns true if the object was a string. False otherwise.
     */
    , isString: function (obj) {
        return toString.call(obj) === '[object String]';
    }
}