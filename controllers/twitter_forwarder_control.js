module.exports = {
    session: {}                    // link to active temboo session
	, model: {                        // holds app configuration and current state information
		"curClientId": 0
		, "clients": {}
		, "page" : {
			"title": "Tweets in Space"
			, "subtitle": "Forward tweets through spacebrew"			
			, "template": {
				"no_auth": "twitter_forwarder_no_auth"
				, "auth": "twitter_forwarder"
			}
		}
		, "base_url": "http://localhost:8002"
		, "forwarding_path": "/twitter/auth?client_id="
		, "authenticated_path": "/twitter/ready?client_id="
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
            this.model.base_url = config["base_url"];	        
	        this.handleOAuthRequest = this.oauth.getHandleOAuthRequest( this );
	        this.handleAppRequest = this.utils.getHandleAppRequest( this );
	        this.handleAuthenticatedRequest = this.utils.getHandleAuthenticatedRequest( this );
			if (this.debug) console.log("[init:Twitter] successfully configured twitter forwarder controller")
		    return this;
		} else {
		    if (this.debug) console.log("[init:Twitter] unable to configure twitter forwarder controller")
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
			, "query": ""
			, "request": {}
			, "results": {}
			, "lastestId": 0
			, "reply": undefined
			, "geo": {
				"lat": 0
				, "long": 0
				, "radius": 0
				, "available": "false"
			}
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
	 * 	twitter_oath.js file for more details
	 */
	, handleOAuthRequest: function(req, res) { 
		if (this.debug) console.log ("[twitter:handleOAuthRequest] placeholder function is being called") 
	}

	/**
	 * Points to callback function that handles requests for the twitter app. These requests 
	 * 	are parsed to extract the app name from the URL. Look at the utils.js file for more 
	 * 	details and to see the code for this method. Method is initialized in init function.  
	 */
	, handleAppRequest: function(req, res) { 
		if (this.debug) console.log ("[twitter:handleAppRequest] placeholder function is being called") 
	}

	/**
	 * Points to callback function that handles authenticated requests for the instagram app. 
	 * 	These requests need to include the client_id that is matched with an ip address to 
	 * 	confirm authentication.  
	 */
	, handleAuthenticatedRequest: function(req, res) { 
		if (this.debug) console.log ("[handleAuthenticatedRequest] placeholder function is being called"); 
	}

    /**
     * handleQueryRequest 		Callback function that handles ajax requests for tweets. The query string 
     * 							in the URL for each request includes a client id and a twitter query term. 
     * 					  		These are used to make the appropriate request to the twitter server, via 
     * 				     		Temboo. A reply callback method is added to the client object. This method 
     * 				       		is used by the queryTemboo function to respond to the ajax request once it 
     * 		           			receives a response from the twitter server.
     *        
     * @param  {Request Object} req 	Express server request object, which includes information about 
     *                          		the HTTP request
     * @param  {Response Object} res 	Express server response object, used to respond to the HTTP request
     */
    , handleQueryRequest: function (req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            , queryJson = JSON.parse(unescape(urlReq.search.replace(/\?/, "")))      // convert string to json (unescape to convert string format first)
            , client                                       // will hold client object
            , self = this
            ;

        if (this.debug) console.log("[handleQueryRequest] json query ", queryJson)

        // if no client id is provided, or client id is invalid, then send user back to unauthorized page
        if (!queryJson.id || !this.model.clients[queryJson.id]) {
            res.redirect( "/twitter"); 
        } 

        // make sure that the required query attributes are included in request
        if (queryJson.data.required) {
			for (var attr in queryJson.data.required) {
				if (!queryJson.data.required[attr].available) {
					if (this.debug) console.log("[handleQueryRequest] required attribute " + queryJson.data.required[attr] + " not available");
					return;
				}
			}
		}

        // check if this query differs from the current one, if so then re-initialize the lastestId, and query vars
        if ((this.model.clients[queryJson.id].query !== queryJson.data.required.query.text)) {
            if (this.debug) console.log("[handleQueryRequest] Query is new");        
            this.model.clients[queryJson.id].lastestId = 0;
            this.model.clients[queryJson.id].query = queryJson.data.required.query.text;
        }

        // if query includes geo filter, then process it
        if (queryJson.data.optional.geo) {
            // check if any of the geo filter attributes have changed then update the client object 
            if ((queryJson.data.optional.geo.lat != this.model.clients[queryJson.id].geo.lat) || 
                (queryJson.data.optional.geo.long != this.model.clients[queryJson.id].geo.long) ||
                (queryJson.data.optional.geo.radius != this.model.clients[queryJson.id].geo.radius) ||
                (queryJson.data.optional.geo.available != this.model.clients[queryJson.id].geo.available)) 
            {
                if (this.debug) console.log("[handleQueryRequest] Geocode included : ", queryJson.data.optional.geo);        
                this.model.clients[queryJson.id].geo.lat = queryJson.data.optional.geo.lat;
                this.model.clients[queryJson.id].geo.long = queryJson.data.optional.geo.long;
                this.model.clients[queryJson.id].geo.radius = queryJson.data.optional.geo.radius;
                this.model.clients[queryJson.id].geo.available = queryJson.data.optional.geo.available;                
                this.model.clients[queryJson.id].lastestId = 0;     // reset last ID to 0
            }
        }

        // create the callback function to respond to request once data has been received from twitter
        this.model.clients[queryJson.id].reply = function(data) {
            if (self.debug) console.log("[handleQueryRequest] callback method: ", data);
            res.end(data);                
        }

        // submit the query and client id to the query twitter app
        this.queryTemboo(queryJson.id, "reply");
    }

    /**
     * queryTemboo 	Submits twitter queries to via the Temboo API engine. 
     * @param  {Integer} clientId     	Id of the client that submitted this query
     * @param  {String} callbackName 	Name of callback method that should be called when results data
     *                                	is received. If none is proved then it will default to reply.
     */
	, queryTemboo: function (clientId, callbackName) {
        var searchT = this.model.clients[clientId].query
            , geocodeT = this.model.clients[clientId].geo
            , geocodeString = undefined
            , callbackName = callbackName || "reply"
            , self = this
        	, Twitter = require("temboo/Library/Twitter/Search")
			, queryChoreo = new Twitter.Tweets(self.session)
			, queryInputs = queryChoreo.newInputSet()
            ;

        if (this.debug) console.log("[queryTemboo] new request made: ", searchT);

        // abort search if query (held in searchT) is not a valid string
        if (!this.utils.isString(searchT)) return;    // return if search term not valid

        // prepare the query by adding authentication elements
		queryInputs.setCredential("TwitterSpacebrewForwarder");
		queryInputs.set_AccessToken(this.model.clients[clientId].auth.access_token);
		queryInputs.set_AccessTokenSecret(this.model.clients[clientId].auth.access_token_secret);

		// configure query with search term and other info
        queryInputs.set_Query(searchT);             // setting the search query    
        queryInputs.set_SinceId(this.model.clients[clientId].lastestId);
        queryInputs.set_IncludeEntities(true);      // request add'l metadata
 
        // if geocode available, then process it and add it to query
        if (geocodeT.available) {
            geocodeString = "" + this.model.clients[clientId].geo.lat 
                            + "," + this.model.clients[clientId].geo.long 
                            + "," + this.model.clients[clientId].geo.radius + "mi";
            queryInputs.set_Geocode(geocodeString);             // setting the search query
            if (this.debug) console.log("[queryTemboo] geocode string: ", geocodeString);
        }

        /**
         * successCallback 	Method that is called by the temboo API when the results from 
         * 					twitter are returned. It process the data and calls the client's 
         * 					handler method to forward the data back to the front end
         * @param {Temboo Results Obect} results 	Results from Temboo Twitter service query
         */
        var successCallback = function(results) {
            var tResults = JSON.parse(results.get_Response()),
                results_list = [],
                newTweet = {}
                ;

            // if the response includes one or more tweets then process it
            if (tResults.statuses.length > 0) {

                // save results in the model
                self.model.clients[clientId].results = tResults.statuses;

                // loop through results to prepare data to send to front end
                for(var i = self.model.clients[clientId].results.length - 1; i >= 0; i--) {
                	// make sure id is a number not a string
	                self.model.clients[clientId].results[i].id = Number(self.model.clients[clientId].results[i].id);

                    // if this is a new tweet then process it
                    if (self.model.clients[clientId].results[i].id > self.model.clients[clientId].lastestId) {

                        newTweet = {
                            "user": unescape(self.model.clients[clientId].results[i].user.name)
                            , "text": unescape(self.model.clients[clientId].results[i].text)
                            , "created_at": unescape(self.model.clients[clientId].results[i].created_at)
                            , "id": self.model.clients[clientId].results[i].id
                            , "photo": self.model.clients[clientId].results[i].user.profile_image_url
                            , "lat": "not available"
                            , "long": "not available"
                        };

                        if (self.model.clients[clientId].results[i]["geo"]) {
                            if (self.model.clients[clientId].results[i].geo["coordinates"]) {
                                newTweet.lat = self.model.clients[clientId].results[i].geo.coordinates[0];
                                newTweet.long = self.model.clients[clientId].results[i].geo.coordinates[1];
                            }
                        }

                        results_list.push(newTweet);

                        // update the id of the most recent message
						self.model.clients[clientId].lastestId = self.model.clients[clientId].results[i].id;
						if (self.debug) console.log("[successCallback] id of last message received ", self.model.clients[clientId].lastestId)                        	
                    }
                }

                // call appropriate response methods for client that made request
                if (self.debug) console.log("[successCallback:queryTemboo] new tweets: ", results_list);
                if (self.model.clients[clientId][callbackName]) {
                    var reply_obj = {"list" : results_list, "query": self.model.clients[clientId].query };
                    self.model.clients[clientId][callbackName](JSON.stringify(reply_obj));
                }
            }
        };

        // Run the choreo, passing the success and error callback handlers
        queryChoreo.execute(
            queryInputs,
            successCallback,
            function(error) {
            	console.log(error.type); 
            	console.log(error.message);
            }
        );
    }
}