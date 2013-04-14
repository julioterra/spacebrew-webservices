module.exports = {
	session: {}
	, model: {}

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
			this.model = config["model"];
			console.log("[init:Twitter] successfully initiated twitter oath ");
			return this;
		} else {
			console.log("[init:Twitter] unable to initiate twitter oath");
			return {};        
		}
	}

	/**
	 * handleOAuthRequest 	Method that handles http requests associated to OAuth athentication for the
	 * 						Foursquare app. It leverages Temboo's OAuth API, in a consistent manner.
	 * @param  {Request Object} req 	Express server request object, which includes information about 
	 *                          		the HTTP request
	 * @param  {Response Object} res 	Express server response object, used to respond to the HTTP request
	 */
	, handleOAuthRequest: function(req, res) {
		var urlReq = require('url').parse(req.url, true)    // get the full URL request
			, client_id = urlReq.query['client_id'] || -1
			, client = this.model.clients[client_id]
			, Twitter = require("temboo/Library/Twitter/OAuth")
			, oauthChoreo = undefined
			, oauthInputs = undefined
			, self = this
			; 

		console.log("[handleOAuthRequest]  client id ", client_id)
		console.log("[handleOAuthRequest] current client's model: ", this.model.clients[client_id])

	    // handle first step of the OAuth authentication flow
		if (!this.model.clients[client.id].auth.oath_started) {
			console.log("[authTemboo] step 1 - client id ", client.id)

			oauthChoreo = new Twitter.InitializeOAuth(self.session);

			oauthInputs = oauthChoreo.newInputSet();
			oauthInputs.setCredential('TwitterSpacebrewForwarder');
			oauthInputs.set_ForwardingURL(this.model.forwarding_url + client.id)

			var intitializeOAuthCallback = function(results){
				console.log("[intitializeOAuthCallback:handleOAuthRequest] initial OAuth successful ", results.get_AuthorizationURL());
				self.model.clients[client_id].auth.auth_token_secret = results.get_OAuthTokenSecret();
				self.model.clients[client_id].auth.callback_id = results.get_CallbackID();
				self.model.clients[client.id].auth.oath_started = true;
				res.redirect(results.get_AuthorizationURL());		    		
			}

			oauthChoreo.execute(
				oauthInputs,
				intitializeOAuthCallback,
				function(error){console.log("start OAuth", error.type); console.log(error.message);}
			);
		}

	    // handle second step of the OAuth authentication flow
		else {
			console.log("[authTemboo] step 2 - client id ", client.id)

			oauthChoreo = new Twitter.FinalizeOAuth(self.session)

			oauthInputs = oauthChoreo.newInputSet();
			oauthInputs.setCredential('TwitterSpacebrewForwarder');
			oauthInputs.set_CallbackID(self.model.clients[client_id].auth.callback_id);
			oauthInputs.set_OAuthTokenSecret(self.model.clients[client_id].auth.auth_token_secret);

			var finalizeOAuthCallback = function(results){
				console.log("[finalizeOAuthCallback:handleOAuthRequest] finish OAuth successful");
				self.model.clients[client_id].auth.access_token = results.get_AccessToken();
				self.model.clients[client_id].auth.access_token_secret = results.get_AccessTokenSecret();

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
				function(error){console.log("final OAuth", error.type); console.log(error.message);}
			);
		} 
	}

	, getHandleOAuthRequest: function( controller ) {

		var handleOAuthRequest = function(req, res) {
			var urlReq = require('url').parse(req.url, true)    // get the full URL request
				, client_id = urlReq.query['client_id'] || -1
				, client = controller.model.clients[client_id]
				, Twitter = require("temboo/Library/Twitter/OAuth")
				, oauthChoreo = undefined
				, oauthInputs = undefined
				// , self = this
				; 

			console.log("[handleOAuthRequest]  client id ", client_id)
			console.log("[handleOAuthRequest] current client's model: ", controller.model.clients[client_id])

		    // handle first step of the OAuth authentication flow
			if (!controller.model.clients[client.id].auth.oath_started) {
				console.log("[authTemboo] step 1 - client id ", client.id)

				oauthChoreo = new Twitter.InitializeOAuth(controller.session);

				oauthInputs = oauthChoreo.newInputSet();
				oauthInputs.setCredential('TwitterSpacebrewForwarder');
				oauthInputs.set_ForwardingURL(controller.model.forwarding_url + client.id)

				var intitializeOAuthCallback = function(results){
					console.log("[intitializeOAuthCallback:handleOAuthRequest] initial OAuth successful ", results.get_AuthorizationURL());
					controller.model.clients[client_id].auth.auth_token_secret = results.get_OAuthTokenSecret();
					controller.model.clients[client_id].auth.callback_id = results.get_CallbackID();
					controller.model.clients[client.id].auth.oath_started = true;
					res.redirect(results.get_AuthorizationURL());		    		
				}

				oauthChoreo.execute(
					oauthInputs,
					intitializeOAuthCallback,
					function(error){console.log("start OAuth", error.type); console.log(error.message);}
				);
			}

		    // handle second step of the OAuth authentication flow
			else {
				console.log("[authTemboo] step 2 - client id ", client.id)

				oauthChoreo = new Twitter.FinalizeOAuth(controller.session)

				oauthInputs = oauthChoreo.newInputSet();
				oauthInputs.setCredential('TwitterSpacebrewForwarder');
				oauthInputs.set_CallbackID(controller.model.clients[client_id].auth.callback_id);
				oauthInputs.set_OAuthTokenSecret(controller.model.clients[client_id].auth.auth_token_secret);

				var finalizeOAuthCallback = function(results){
					console.log("[finalizeOAuthCallback:handleOAuthRequest] finish OAuth successful");
					controller.model.clients[client_id].auth.access_token = results.get_AccessToken();
					controller.model.clients[client_id].auth.access_token_secret = results.get_AccessTokenSecret();

					client = controller.model.clients[client_id];
					res.render(controller.model.page.template.auth,
						{ 
							"title" : controller.model.page.title           
							, "subTitle" : controller.model.page.subtitle
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
					function(error){console.log("final OAuth", error.type); console.log(error.message);}
				);
			} 
		}
		return handleOAuthRequest;
	}
}