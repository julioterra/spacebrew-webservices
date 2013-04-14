module.exports = {
	
    getHandleAppRequest: function ( controller ) {
 
		var handleAppRequest = function (req, res) {
			var urlReq = require('url').parse(req.url, true)    // get the full URL request
				, client = controller.newClient()
				;

			// create the query string that will be appended to the redirect urls
			if (urlReq.query['server']) client.query_str["server"] = urlReq.query['server'];       
			if (urlReq.query['port']) client.query_str["port"] = urlReq.query['port'];        
			if (urlReq.query['name']) client.query_str["name"] = urlReq.query['name'];
			if (urlReq.query['description']) client.query_str["description"] = urlReq.query['description'];
			if (urlReq.query['refresh']) client.query_str["refresh"] = urlReq.query['refresh'];
			if (urlReq.query['debug']) client.query_str["debug"] = urlReq.query['debug'];

			console.log("[handleAppRequest] loaded query string settings ", controller.model.clients[client.id].query_str)

			res.render(controller.model.page.template.no_auth,
				{ 
					"title" : controller.model.page.title           
					, "subTitle" : controller.model.page.subtitle
					, "clientId" : client.id
					, "authConfirm" : false
					, "queryStr" : client.query_str
				}
			)                                
		}

		return handleAppRequest;
    }

	/**
	 * isString Function that checks whether an object is a string
	 * @param  {Object}  obj Object that will be checked to confirm whether it is a string
	 * @return {Boolean}     Returns true if the object was a string. False otherwise.
	 */
	, isString: function (obj) {
		return toString.call(obj) === '[object String]';
	}

}