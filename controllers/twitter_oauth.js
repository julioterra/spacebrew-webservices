module.exports = {

	/**
	 * handleOAuthRequest 	Method that handles http requests associated to OAuth athentication for the
	 * 						Foursquare app. It leverages Temboo's OAuth API, in a consistent manner.
	 * @param  {Request Object} req 	Express server request object, which includes information about 
	 *                          		the HTTP request
	 * @param  {Response Object} res 	Express server response object, used to respond to the HTTP request
	 */
	getHandleOAuthRequest: function( controller ) {

		var handleOAuthRequest = function(req, res) {
			var urlReq = require('url').parse(req.url, true)    // get the full URL request
				, client_id = urlReq.query['client_id'] || -1
				, client = controller.model.clients[client_id]
				, Twitter = require("temboo/Library/Twitter/OAuth")
				, oauthChoreo = undefined
				, oauthInputs = undefined
				// , self = this
				; 

			if (controller.debug) console.log("[handleOAuthRequest]  client id ", client_id)
			if (controller.debug) console.log("[handleOAuthRequest] current client's model: ", controller.model.clients[client_id])

		    // handle first step of the OAuth authentication flow
			if (!controller.model.clients[client.id].auth.oath_started) {
				if (controller.debug) console.log("[authTemboo] step 1 - client id ", client.id)

				oauthChoreo = new Twitter.InitializeOAuth(controller.session);

				oauthInputs = oauthChoreo.newInputSet();
				oauthInputs.setCredential('TwitterSpacebrewForwarder');
				oauthInputs.set_ForwardingURL(controller.model.base_url + controller.model.forwarding_path + client.id)

				var intitializeOAuthCallback = function(results){
					if (controller.debug) console.log("[intitializeOAuthCallback:handleOAuthRequest] initial OAuth successful ", results.get_AuthorizationURL());
					controller.model.clients[client_id].auth.auth_token_secret = results.get_OAuthTokenSecret();
					controller.model.clients[client_id].auth.callback_id = results.get_CallbackID();
					controller.model.clients[client.id].auth.oath_started = true;
					res.redirect(results.get_AuthorizationURL());		    		
				}

				oauthChoreo.execute(
					oauthInputs,
					intitializeOAuthCallback,
					function(error){
						console.log("start OAuth", error.type); 
						console.log(error.message);
					}
				);
			}

		    // handle second step of the OAuth authentication flow
			else {
				if (controller.debug) console.log("[authTemboo] step 2 - client id ", client.id)

				oauthChoreo = new Twitter.FinalizeOAuth(controller.session)

				oauthInputs = oauthChoreo.newInputSet();
				oauthInputs.setCredential('TwitterSpacebrewForwarder');
				oauthInputs.set_CallbackID(controller.model.clients[client_id].auth.callback_id);
				oauthInputs.set_OAuthTokenSecret(controller.model.clients[client_id].auth.auth_token_secret);

				var finalizeOAuthCallback = function(results){
					if (controller.debug) console.log("[finalizeOAuthCallback:handleOAuthRequest] finish OAuth successful");
					controller.model.clients[client_id].auth.access_token = results.get_AccessToken();
					controller.model.clients[client_id].auth.access_token_secret = results.get_AccessTokenSecret();
			    	res.redirect(controller.model.base_url + controller.model.authenticated_path + client_id);
			    }

				// Run the choreo, specifying success and error callback handlers
				oauthChoreo.execute(
					oauthInputs,
					finalizeOAuthCallback,
					function(error){
						console.log("final OAuth", error.type); 
						console.log(error.message);
					}
				);
			} 
		}
		return handleOAuthRequest;
	}
}