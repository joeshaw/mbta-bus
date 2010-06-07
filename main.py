#!/usr/bin/env python

from wsgiref.handlers import CGIHandler
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp import RequestHandler
from google.appengine.ext.webapp import WSGIApplication
from google.appengine.api.urlfetch import fetch

class MainHandler(RequestHandler):

	def get(self):
		self.response.out.write(template.render('index.html', {}))

handlers = [
	('/', MainHandler),
]

def main():
  application = WSGIApplication(handlers, debug=True)
  CGIHandler().run(application)

if __name__ == '__main__':
  main()
