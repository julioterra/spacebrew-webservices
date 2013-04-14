module.exports = {
    session: {}         		// link to active temboo session
    , utils: require("./utils.js")
    , model: {           		// holds app configuration and current state information
        "curClientId": 0
        , "clients": {}
		, "page" : {
			"title": "Instagram in Space"
			, "subtitle": "Forwarding instagram photos to spacebrew"			
			, "template": {
				"no_auth": "instagram_forwarder_no_auth"
				, "auth": "instagram_forwarder"
			}
		}
		, "forwarding_url": "http://localhost:8002/instagram/auth?client_id="
    }

    /**
     * init 	Method that initializes the controller object by getting a reference to the
     * 			Temboo session object.
     * @param  {Object} config  Configuration object that includes the auth settings 
     *                          and the session object.
     * @return {Object}         Foursquare control object if config object was valid,
     *                          otherwise it returns an empty object.
     */
    , init: function( config ) {
        if (config["session"]) {
            this.session = config["session"];
	        this.handleAppRequest = this.utils.getHandleAppRequest( this );
            console.log("[init:foursquareControl] successfully configured fourquare controller")
            return this;            
        } else {
            console.log("[init:foursquareControl] unable to configure fourquare controller")
            return {};        
        }
    }

    /**
     * newClient 	Increments the curClientId and then add a new client to the this.model.clients 
     * 				object, assigning to it the new client id.
     * @param  {Object} config      Configuration object with an application name
     * @return {Object}             Returns the client object that was just created
     */
    , newClient: function (config) {
        this.model.curClientId++;               // update curClientId number
        var clientId = this.model.curClientId;  // assign id number for current client
        this.model.clients[clientId] = {        // initialize the current client object
			"id": clientId
			, "query": ""
			, "results": {}
			, "lastId": 0
			, "reply": undefined
			, "auth": {
				"code": ""
				, "access_token": ""
				, "oath_started": false
			}
			, "query_str": {
				"server": "sandbox.spacebrew.cc"
				, "port": 9000
				, "name": "instagram_forwarder"
				, "description": "web app that forwards instagram pictures to spacebrew"
				, "refresh": undefined
			}
        } 
        console.log("[newClient] new client created ", this.model.clients[clientId])
        console.log("[newClient] model ", this.model)
        return this.model.clients[clientId];    // return reference to current client object
    }

	/**
	 * Points to callback function that handles requests for the instagram app. These requests 
	 * 	are parsed to extract the app name from the URL. Look at the utils.js file for more 
	 * 	details and to see the code for this method. Method is initialized in init function.  
	 */
	, handleAppRequest: function(req, res) { 
		console.log ("[handleAppRequest] placeholder function is being called") 
	}

    /**
     * handleOAuthRequest 	Method that handles http requests associated to OAuth athentication for the
     * 						instagram app. It leverages Temboo's OAuth API, in a consistent manner.
     * @param  {Request Object} req Express server request object, which includes information about the HTTP request
     * @param  {Response Object} res Express server response object, used to respond to the HTTP request
     */
    , handleOAuthRequest: function(req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            , client_id = urlReq.query['client_id'] || -1
            , client = this.model.clients[client_id]
            , instagram = require("temboo/Library/Instagram/OAuth")
            , oauthChoreo = new instagram.InitializeOAuth(this.session)
            , oauthInputs = oauthChoreo.newInputSet()
            , self = this
            ; 

        console.log("[handleOAuthRequest] model clients: ", this.model.clients)

        console.log("[handleOAuthRequest] current client's model: ", this.model.clients[client_id])

        // handle first step of the OAuth authentication flow
		if (!this.model.clients[client.id].auth.oath_started) {

            console.log("[handleOAuthRequest] step 1 - client id ", client.id)

			oauthInputs.setCredential('InstagramSpacebrewForwarder');
			oauthInputs.set_ForwardingURL(this.model.forwarding_url + client.id)

			var intitializeOAuthCallback = function(results){
			    	console.log("[intitializeOAuthCallback:handleOAuthRequest] initial OAuth successful ", results.get_AuthorizationURL());
			    	self.model.clients[client_id].auth.callback_id = results.get_CallbackID();
			    	self.model.clients[client.id].auth.oath_started = true;
			    	res.redirect(results.get_AuthorizationURL());		
			    }

			oauthChoreo.execute(
			    oauthInputs,
			    intitializeOAuthCallback,
			    function(error){console.log("ERROR: start OAuth", error.type); console.log(error.message);}
			);
		}

        // handle second step of the OAuth authentication flow
		else {
            console.log("[handleOAuthRequest] step 2 - client id ", client.id)

		    oauthChoreo = new instagram.FinalizeOAuth(self.session)

			oauthInputs = oauthChoreo.newInputSet();
			oauthInputs.setCredential('InstagramSpacebrewForwarder');
			oauthInputs.set_CallbackID(self.model.clients[client_id].auth.callback_id);

			var finalizeOAuthCallback = function(results){
		    	console.log("[finalizeOAuthCallback:handleOAuthRequest] finish OAuth successful");
		    	self.model.clients[client_id].auth.access_token = results.get_AccessToken();

	            client = self.model.clients[client_id];
				res.render(self.model.page.template.auth,
					{ 
						"title" : self.model.page.title
						, "subTitle" : self.model.page.subtitle
						, "clientId" : client.id
						, "authConfirm" : true
						, "queryStr" : client.query_str
	                }
	            )                                            
		    }

			// Run the choreo, specifying success and error callback handlers
			oauthChoreo.execute(
			    oauthInputs,
			    finalizeOAuthCallback,
			    function(error){console.log("ERROR: final OAuth", error.type); console.log(error.message);}
			);
		} 
    }

    /**
     * handleQueryRequest 		Callback function that handles ajax requests for new content. The query 
     * 							string in the URL for each request includes a client id and optional params, 
     * 							such as long and latitude. These are used to make the appropriate request to 
     * 							foursquare via Temboo. A reply callback method is added to the client object. 
     * 							This method is used by the queryTemboo function to respond to the ajax request 
     * 							once it receives a response from the foursquare server.
     *        
     * @param  {Request Object} req 	Express server request object, which includes information about the 
     *                          		HTTP request
     * @param  {Response Object} res 	Express server response object, used to respond to the HTTP request
     */
    , handleQueryRequest: function (req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            , queryJson = JSON.parse(unescape(urlReq.search.replace(/\?/, "")))       // convert string to json (unescape to convert string format first)
            , client                                        // will hold client object
            ;

        console.log("[handleQueryRequest] query string in json: ", queryJson)

        // if no client id is provided, or client id is invalid, then send user back to unauthorized page
        if (!queryJson.id || !this.model.clients[queryJson.id]) {
            res.redirect( "/instagram"); 
        } 

        // check if this query differs from the current one, if so then re-initialize the lastId, and query vars
        if ((this.model.clients[queryJson.id].query !== queryJson.data.required.query.text)) {
            console.log("[handleQueryRequest] Query is new");        
            this.model.clients[queryJson.id].lastId = 0;
            this.model.clients[queryJson.id].query = queryJson.data.required.query.text;
        }

        // // set the ajax_req flag to true and create the callback function
        this.model.clients[queryJson.id].reply = function(data) {
            console.log("[reply:handleQueryRequest] callback method, rendering data: ", data);
            res.end(data);                
        }

        this.queryTemboo(queryJson.id, "reply");
    }

    /**
     * queryTemboo Function that submits foursquare API requests via the Temboo API engine. 
     * @param  {Integer}    clientId        Id of the client that submitted this query
     * @param  {String}     callbackName    Name of callback method that should be called when results data
     *                                      is received. If none is proved then it will default to reply.
     */
    , queryTemboo: function (clientId, callbackName) {
        var query = this.model.clients[clientId].query
            , callbackName = callbackName || "reply"
            , instagram = require("temboo/Library/Instagram")
            , queryChoreo = new instagram.RecentlyTaggedMedia(this.session)
            , queryInputs = queryChoreo.newInputSet()
            , self = this
            ;

        console.log("[queryTemboo] new request made: ", query);
        console.log("[queryTemboo] auth token: ",this.model.clients[clientId].auth.access_token)

        if (!this.utils.isString(query)) return;    // return if search term not valid

        // Instantiate and populate the input set for the choreo
		queryInputs.set_MinID(self.model.clients[clientId].lastId);
		queryInputs.set_AccessToken(this.model.clients[clientId].auth.access_token);
		queryInputs.set_TagName(query);

        /**
         * successCallback Method that is called by the temboo API when the results from twitter are
         *     returned. It process the data and calls the client's handler method to forward the
         *     data back to the front end
         * @param  {Temboo Results Obect} results Results from Temboo Foursquare service query
         */
        var successCallback = function( results ) {
            var tResults = JSON.parse(results.get_Response())
                , results_list = []
                , result_item = {} 
                ;

            // console.log( "[successCallback] results received - string: ", results.get_Response() );
            console.log( "[successCallback:queryTemboo] results received - json: ", tResults );

            // check if results received by verifying that tResults object contains a response.recent attribute
            if (tResults["data"]) {

				// store the results in the appropriate client
				self.model.clients[clientId].results = tResults.data;
	            console.log( "[successCallback:queryTemboo] here are the results: ", tResults.data );

				// loop through each check-in to parse and store the data
				for(var i = tResults.data.length - 1; i >= 0; i--) {
				    // if this is a new check in then process it
					result_item = {
					    // "user": tResults.response["recent"][i].username
					    // , "photo": tResults.response["recent"][i].user.photo,
					};
					console.log( "[successCallback:queryTemboo] new check-in created, index number: " + i, result_item);

					// add new checkin to checkIns array
					results_list.push(result_item);

					// update the id of the most recent message
					if (self.model.clients[clientId].lastId < self.model.clients[clientId].results[i].id) {
						self.model.clients[clientId].lastId = self.model.clients[clientId].results[i].id;
						console.log("[successCallback] id of last message received ", self.model.clients[clientId].lastId)
					}
                }

                // call appropriate response methods for client that made request
                if (self.model.clients[clientId][callbackName]) {
                    var reply_obj = { "list" : results_list };
                    console.log("\n[successCallback:queryTemboo] sending json response: ", JSON.stringify(reply_obj));
                    self.model.clients[clientId][callbackName](JSON.stringify(reply_obj));
                }
            }
        };

        // Run the choreo, passing the success and error callback handlers
        queryChoreo.execute(
            queryInputs,
            successCallback,
            function(error) {console.log(error.type); console.log(error.message);}
        );
    }
}