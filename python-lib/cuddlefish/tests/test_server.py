import os
import unittest

from cuddlefish.docs import webdocs
from cuddlefish import server
from cuddlefish.tests import env_root

class UnprivilegedServerTests(unittest.TestCase):
    def request(self, path, method='GET'):
        web_docs = webdocs.WebDocs(env_root)
        app = server.make_wsgi_app(env_root, web_docs, task_queue=None,
                                   expose_privileged_api=False)

        def start_response(code, headers):
            pass

        environ = {'PATH_INFO': path,
                   'REQUEST_METHOD': method}

        responses = [string for string in app(environ, start_response)]
        return ''.join(responses)

    def test_privileged_api_returns_404(self):
        self.assertEqual(self.request('/api/blah'),
                         '404 Not Found')

    def test_privileged_api_returns_501(self):
        self.assertEqual(self.request('/api/idle'),
                         '501 Not Implemented')
        self.assertEqual(self.request('/api/task-queue'),
                         '501 Not Implemented')

if __name__ == '__main__':
    unittest.main()
