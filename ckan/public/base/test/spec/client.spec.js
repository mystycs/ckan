/*globals describe beforeEach afterEach it assert sinon ckan jQuery */
describe('ckan.Client()', function () {
  var Client = ckan.Client;

  beforeEach(function () {
    this.client = new Client();
  });

  it('should add a new instance to each client', function () {
    var target = ckan.sandbox().client;

    assert.instanceOf(target, Client);
  });

  it('should set the .endpoint property to options.endpoint', function () {
    var client = new Client({endpoint: 'http://example.com'});
    assert.equal(client.endpoint, 'http://example.com');
  });

  it('should default the endpoint to a blank string', function () {
    assert.equal(this.client.endpoint, '');
  });

  describe('.url(path)', function () {
    beforeEach(function () {
      this.client.endpoint = 'http://api.example.com';
    });

    it('should return the path with the enpoint prepended', function () {
      assert.equal(this.client.url('/api/endpoint'), 'http://api.example.com/api/endpoint');
    });

    it('should normalise preceding slashes in the path', function () {
      assert.equal(this.client.url('api/endpoint'), 'http://api.example.com/api/endpoint');
    });

    it('should return the string if it already has a protocol', function () {
      assert.equal(this.client.url('http://example.com/my/endpoint'), 'http://example.com/my/endpoint');
    });
  });

  describe('.getTemplate(filename, params, success, error)', function () {
    beforeEach(function () {
      this.fakePromise = sinon.stub(jQuery.Deferred());
      this.fakePromise.then.returns(this.fakePromise);
      sinon.stub(jQuery, 'get').returns(this.fakePromise);
    });

    afterEach(function () {
      jQuery.get.restore();
    });

    it('should return a jQuery promise', function () {
      var target = this.client.getTemplate('test.html');
      assert.ok(target === this.fakePromise, 'target === this.fakePromise'); 
    });

    it('should request the template file', function () {
      var target = this.client.getTemplate('test.html');
      assert.called(jQuery.get);
      assert.calledWith(jQuery.get, '/api/1/util/snippet/test.html', {});
    });

    it('should request the template file with any provided params', function () {
      var options = {limit: 5, page: 2};
      var target = this.client.getTemplate('test.html', options);
      assert.called(jQuery.get);
      assert.calledWith(jQuery.get, '/api/1/util/snippet/test.html', options);
    });
  });

  describe('.getLocaleData(locale, success, error)', function () {
    beforeEach(function () {
      this.fakePromise = sinon.stub(jQuery.Deferred());
      this.fakePromise.then.returns(this.fakePromise);
      sinon.stub(jQuery, 'getJSON').returns(this.fakePromise);
    });

    afterEach(function () {
      jQuery.getJSON.restore();
    });

    it('should return a jQuery promise', function () {
      var target = this.client.getLocaleData('en');
      assert.ok(target === this.fakePromise, 'target === this.fakePromise'); 
    });

    it('should request the locale provided', function () {
      var target = this.client.getLocaleData('en');
      assert.called(jQuery.getJSON);
      assert.calledWith(jQuery.getJSON, '/api/i18n/en');
    });
  });

  describe('.getCompletions(url, options, success, error)', function () {
    beforeEach(function () {
      this.fakePiped  = sinon.stub(jQuery.Deferred());
      this.fakePiped.then.returns(this.fakePiped);
      this.fakePiped.promise.returns(this.fakePiped);

      this.fakePromise = sinon.stub(jQuery.Deferred());
      this.fakePromise.pipe.returns(this.fakePiped);

      sinon.stub(jQuery, 'ajax').returns(this.fakePromise);
    });

    afterEach(function () {
      jQuery.ajax.restore();
    });

    it('should return a jQuery promise', function () {
      var target = this.client.getCompletions('url');
      assert.ok(target === this.fakePiped, 'target === this.fakePiped');
    });

    it('should make an ajax request for the url provided', function () {
      function success() {}
      function error() {}

      var target = this.client.getCompletions('url', success, error);

      assert.called(jQuery.ajax);
      assert.calledWith(jQuery.ajax, {url: '/url'});

      assert.called(this.fakePiped.then);
      assert.calledWith(this.fakePiped.then, success, error);
    });

    it('should pipe the result through .parseCompletions()', function () {
      var target = this.client.getCompletions('url');

      assert.called(this.fakePromise.pipe);
      assert.calledWith(this.fakePromise.pipe, this.client.parseCompletions);
    });

    it('should allow a custom format option to be provided', function () {
      function format() {}

      var target = this.client.getCompletions('url', {format: format});

      assert.called(this.fakePromise.pipe);
      assert.calledWith(this.fakePromise.pipe, format);
    });

  });

  describe('.parseCompletions(data, options)', function () {
    it('should return a string of tags for a ResultSet collection', function () {
      var data = {
        ResultSet: {
          Result: [
            {"Name": "1 percent"}, {"Name": "18thc"}, {"Name": "19thcentury"}
          ]
        }
      };

      var target = this.client.parseCompletions(data, {});

      assert.deepEqual(target, ["1 percent", "18thc", "19thcentury"]);
    });

    it('should return a string of formats for a ResultSet collection', function () {
      var data = {
        ResultSet: {
          Result: [
            {"Format": "json"}, {"Format": "csv"}, {"Format": "text"}
          ]
        }
      };

      var target = this.client.parseCompletions(data, {});

      assert.deepEqual(target, ["json", "csv", "text"]);
    });

    it('should strip out duplicates with a case insensitive comparison', function () {
      var data = {
        ResultSet: {
          Result: [
            {"Name": " Test"}, {"Name": "test"}, {"Name": "TEST"}
          ]
        }
      };

      var target = this.client.parseCompletions(data, {});

      assert.deepEqual(target, ["Test"]);
    });

    it('should return an array of objects if options.objects is true', function () {
      var data = {
        ResultSet: {
          Result: [
            {"Format": "json"}, {"Format": "csv"}, {"Format": "text"}
          ]
        }
      };

      var target = this.client.parseCompletions(data, {objects: true});

      assert.deepEqual(target, [
        {id: "json", text: "json"},
        {id: "csv", text: "csv"},
        {id: "text", text: "text"}
      ]);
    });

    it('should call .parsePackageCompletions() id data is a string', function () {
      var data = 'Name|id';
      var target = sinon.stub(this.client, 'parsePackageCompletions');

      this.client.parseCompletions(data, {objects: true});

      assert.called(target);
      assert.calledWith(target, data);
    });
  });

  describe('.parseCompletionsForPlugin(data)', function () {
    it('should return a string of tags for a ResultSet collection', function () {
      var data = {
        ResultSet: {
          Result: [
            {"Name": "1 percent"}, {"Name": "18thc"}, {"Name": "19thcentury"}
          ]
        }
      };

      var target = this.client.parseCompletionsForPlugin(data);

      assert.deepEqual(target, {
        results: [
          {id: "1 percent", text: "1 percent"},
          {id: "18thc", text:  "18thc"},
          {id: "19thcentury", text: "19thcentury"}
        ]
      });
    });
  });

  describe('.parsePackageCompletions(string, options)', function () {
    it('should parse the package completions string', function () {
      var data = 'Package 1|package-1\nPackage 2|package-2\nPackage 3|package-3\n';
      var target = this.client.parsePackageCompletions(data);

      assert.deepEqual(target, ['package-1', 'package-2', 'package-3']);
    });

    it('should return an object if options.object is true', function () {
      var data = 'Package 1|package-1\nPackage 2|package-2\nPackage 3|package-3\n';
      var target = this.client.parsePackageCompletions(data, {objects: true});

      assert.deepEqual(target, [
        {id: 'package-1', text: 'Package 1'},
        {id: 'package-2', text: 'Package 2'},
        {id: 'package-3', text: 'Package 3'}
      ]);
    });
  });

  describe('.getStorageAuth()', function () {
    beforeEach(function () {
      this.fakePromise = sinon.mock(jQuery.Deferred());
      sinon.stub(jQuery, 'ajax').returns(this.fakePromise);
    });

    afterEach(function () {
      jQuery.ajax.restore();
    });

    it('should return a jQuery promise', function () {
      var target = this.client.getStorageAuth('filename');
      assert.equal(target, this.fakePromise);
    });

    it('should call request a new auth token', function () {
      function success() {}
      function error() {}

      var target = this.client.getStorageAuth('filename', success, error);

      assert.called(jQuery.ajax);
      assert.calledWith(jQuery.ajax, {
        url: '/api/storage/auth/form/filename',
        success: success,
        error: error
      });
    });
  });

  describe('.getStorageMetadata()', function () {
    beforeEach(function () {
      this.fakePromise = sinon.mock(jQuery.Deferred());
      sinon.stub(jQuery, 'ajax').returns(this.fakePromise);
    });

    afterEach(function () {
      jQuery.ajax.restore();
    });

    it('should return a jQuery promise', function () {
      var target = this.client.getStorageMetadata('filename');
      assert.equal(target, this.fakePromise);
    });

    it('should call request a new auth token', function () {
      function success() {}
      function error() {}

      var target = this.client.getStorageMetadata('filename', success, error);

      assert.called(jQuery.ajax);
      assert.calledWith(jQuery.ajax, {
        url: '/api/storage/metadata/filename',
        success: success,
        error: error
      });
    });

    it('should throw an error if no filename is provided', function () {
      var client = this.client;
      assert.throws(function () {
        client.getStorageMetadata();
      });
    });
  });

  describe('.convertStorageMetadataToResource(meta)', function () {
    beforeEach(function () {
      this.meta = {
        "_checksum": "md5:527c97d2aa3ed1b40aea4b7ddf98692e",
        "_content_length": 122632,
        "_creation_date": "2012-07-17T14:35:35",
        "_label": "2012-07-17T13:35:35.540Z/cat.jpg",
        "_last_modified": "2012-07-17T14:35:35",
        "_location": "http://example.com/storage/f/2012-07-17T13%3A35%3A35.540Z/cat.jpg",
        "filename-original": "cat.jpg",
        "key": "2012-07-17T13:35:35.540Z/cat.jpg",
        "uploaded-by": "user"
      };
    });

    it('should return a representation for a resource', function () {
      var target = this.client.convertStorageMetadataToResource(this.meta);

      assert.deepEqual(target, {
        url: 'http://example.com/storage/f/2012-07-17T13%3A35%3A35.540Z/cat.jpg',
        key: '2012-07-17T13:35:35.540Z/cat.jpg',
        name: 'cat.jpg',
        size: 122632,
        created: "2012-07-17T14:35:35",
        last_modified: "2012-07-17T14:35:35",
        format: 'jpg',
        mimetype: null,
        resource_type: 'file.upload', // Is this standard?
        owner: 'user',
        hash: 'md5:527c97d2aa3ed1b40aea4b7ddf98692e',
        cache_url: 'http://example.com/storage/f/2012-07-17T13%3A35%3A35.540Z/cat.jpg',
        cache_url_updated: '2012-07-17T14:35:35'
      });
    });

    it('should provide a full url', function () {
      ckan.SITE_ROOT = 'http://example.com';

      this.meta._location = "/storage/f/2012-07-17T13%3A35%3A35.540Z/cat.jpg";
      var target = this.client.convertStorageMetadataToResource(this.meta);
      assert.equal(target.url, 'http://example.com/storage/f/2012-07-17T13%3A35%3A35.540Z/cat.jpg');
    });

    it('should not include microseconds or timezone in timestamps', function () {
      ckan.SITE_ROOT = 'http://example.com';

      var target = this.client.convertStorageMetadataToResource(this.meta);
      assert.ok(!(/\.\d\d\d/).test(target.last_modified), 'no microseconds');
      assert.ok(!(/((\+|\-)\d{4}|Z)$/).test(target.last_modified), 'no timezone');
    });

    it('should use the mime type for the format if found', function () {
      this.meta._format = 'image/jpeg';
      var target = this.client.convertStorageMetadataToResource(this.meta);

      assert.equal(target.format, 'image/jpeg', 'format');
      assert.equal(target.mimetype, 'image/jpeg', 'mimetype');
    });
  });

  describe('.normalizeTimestamp(timestamp)', function () {
    it('should add a timezone to a timestamp without one', function () {
      var target = this.client.normalizeTimestamp("2012-07-17T14:35:35");
      assert.equal(target, "2012-07-17T14:35:35Z");
    });

    it('should not add a timezone to a timestamp with one already', function () {
      var target = this.client.normalizeTimestamp("2012-07-17T14:35:35Z");
      assert.equal(target, "2012-07-17T14:35:35Z", 'timestamp with Z');

      target = this.client.normalizeTimestamp("2012-07-17T14:35:35+0100");
      assert.equal(target, "2012-07-17T14:35:35+0100", 'timestamp with +0100');

      target = this.client.normalizeTimestamp("2012-07-17T14:35:35-0400");
      assert.equal(target, "2012-07-17T14:35:35-0400", 'timestamp with -0400');
    });
  });
});
