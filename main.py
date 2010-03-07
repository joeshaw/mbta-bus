#!/usr/bin/env python

from wsgiref.handlers import CGIHandler
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp import RequestHandler
from google.appengine.ext.webapp import WSGIApplication
from google.appengine.api.urlfetch import fetch

class MainHandler(RequestHandler):

	def get(self):
		self.response.out.write(template.render('index.html', {}))

class GetRoutesHandler(RequestHandler):
	def get(self):
		self.response.headers['Content-Type'] = 'text/xml'
		r = fetch('http://webservices.nextbus.com/service/publicXMLFeed?command=routeList&a=mbta')
		self.response.out.write(r.content)
		
class VehicleLocationsHandler(RequestHandler):
	last_request_time = {}
	
	def get(self):
		route = int(self.request.get('route'))

		last_time = self.last_request_time.get(route, 0)
		
		self.response.headers['Content-Type'] = 'text/xml'
		r = fetch('http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=mbta&r=%d&t=%d'
		          % (route, last_time))
		self.response.out.write(r.content)

handlers = [
	('/', MainHandler),
	('/getroutes/', GetRoutesHandler),
	('/vehiclelocations/', VehicleLocationsHandler)
]

def main():
  application = WSGIApplication(handlers, debug=True)
  CGIHandler().run(application)

if __name__ == '__main__':
  main()
