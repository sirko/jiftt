(function($){
  var xhr = new XMLHttpRequest();
  var storage = chrome.storage.local;
  var user = {
    login: " ",
    password: " ",
    tasks: [],
    save: function(){}
  };
  var jira_settins = {};
  var login = "test";
  /*
   * We will use cached data here
   */

  // chrome.storage.sync.set({"login":login}, function(){
  // });
  //chrome.storage.sync.get("login", function(val) {console.log('Restored login:'+val.login)});
  //

  /**
   * Oauth implementation
   */
  var tokenFetcher = (function() {
    // Replace clientId and clientSecret with values obtained by you for your
    // application https://github.com/settings/applications.
    var clientId = '';
    var clientSecret = '';
    var redirectUri = chrome.identity.getRedirectURL('provider_cb');
    var redirectRe = new RegExp(redirectUri + '[#\?](.*)');

    var access_token = null;

    return {
      getToken: function(interactive, callback) {
        // In case we already have an access_token cached, simply return it.
        if (access_token) {
          callback(null, access_token);
          return;
        }

        var options = {
          'interactive': interactive,
          url:'http://jira.propeople.com.ua/jira/plugins/servlet/oauth/authorize?oauth_token=' + clientId +
              '&reponse_type=token' +
              '&access_type=online' +
              '&redirect_uri=' + encodeURIComponent(redirectUri)
        }
        chrome.identity.launchWebAuthFlow(options, function(redirectUri) {
          console.log('launchWebAuthFlow completed', chrome.runtime.lastError,
              redirectUri);

          if (chrome.runtime.lastError) {
            callback(new Error(chrome.runtime.lastError));
            return;
          }

          // Upon success the response is appended to redirectUri, e.g.
          // https://{app_id}.chromiumapp.org/provider_cb#access_token={value}
          //     &refresh_token={value}
          // or:
          // https://{app_id}.chromiumapp.org/provider_cb#code={value}
          var matches = redirectUri.match(redirectRe);
          if (matches && matches.length > 1)
            handleProviderResponse(parseRedirectFragment(matches[1]));
          else
            callback(new Error('Invalid redirect URI'));
        });

        function parseRedirectFragment(fragment) {
          var pairs = fragment.split(/&/);
          var values = {};

          pairs.forEach(function(pair) {
            var nameval = pair.split(/=/);
            values[nameval[0]] = nameval[1];
          });

          return values;
        }

        function handleProviderResponse(values) {
          console.log('providerResponse', values);
          if (values.hasOwnProperty('access_token'))
            setAccessToken(values.access_token);
          // If response does not have an access_token, it might have the code,
          // which can be used in exchange for token.
          else if (values.hasOwnProperty('code'))
            exchangeCodeForToken(values.code);
          else
            callback(new Error('Neither access_token nor code avialable.'));
        }

        function exchangeCodeForToken(code) {
          var xhr = new XMLHttpRequest();
          xhr.open('GET',
                   'https://github.com/login/oauth/access_token?' +
                   'client_id=' + clientId +
                   '&client_secret=' + clientSecret +
                   '&redirect_uri=' + redirectUri +
                   '&code=' + code);
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.onload = function () {
            // When exchanging code for token, the response comes as json, which
            // can be easily parsed to an object.
            if (this.status === 200) {
              var response = JSON.parse(this.responseText);
              console.log(response);
              if (response.hasOwnProperty('access_token')) {
                setAccessToken(response.access_token);
              } else {
                callback(new Error('Cannot obtain access_token from code.'));
              }
            } else {
              console.log('code exchange status:', this.status);
              callback(new Error('Code exchange failed'));
            }
          };
          xhr.send();
        }

        function setAccessToken(token) {
          access_token = token;
          console.log('Setting access_token: ', access_token);
          callback(null, access_token);
        }
      },

      removeCachedToken: function(token_to_remove) {
        if (access_token == token_to_remove)
          access_token = null;
      }
    }
  })();

  function xhrWithAuth(method, url, interactive, callback) {
    var retry = true;
    var access_token;

    console.log('xhrWithAuth', method, url, interactive);
    getToken();

    function getToken() {
      tokenFetcher.getToken(interactive, function(error, token) {
        console.log('token fetch', error, token);
        if (error) {
          callback(error);
          return;
        }

        access_token = token;
        requestStart();
      });
    }

    function requestStart() {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
      xhr.onload = requestComplete;
      xhr.send();
    }

    function requestComplete() {
      console.log('requestComplete', this.status, this.response);
      if ( ( this.status < 200 || this.status >=300 ) && retry) {
        retry = false;
        tokenFetcher.removeCachedToken(access_token);
        access_token = null;
        getToken();
      } else {
        callback(null, this.status, this.response);
      }
    }
  }
  xhrWithAuth('GET',
                'http://api.github.com/user',
                true,
                testCallback);


  // var output = document.getElementById('output');
  // var input = document.getElementById('myValue');
  // var form = document.querySelector('form');
  // var logarea = document.querySelector('textarea');

  // function log(str) {
  //   logarea.value=str+"\n"+logarea.value;
  // }

  // form.addEventListener('submit', function(ev) {
  //   var newValue=input.value;
  //   chrome.storage.sync.set({"myValue": newValue}, function() {
  //     log("setting myValue to "+newValue);
  //   });
  //   ev.preventDefault();
  // });

  // function valueChanged(newValue) {
  //   output.innerText = newValue;
  //   output.className="changed";
  //   window.setTimeout(function() {output.className="";}, 200);
  //   log("value myValue changed to "+newValue);
  // }

  // // For debugging purposes:
  // function debugChanges(changes, namespace) {
  //   for (key in changes) {
  //     console.log('Storage change: key='+key+' value='+JSON.stringify(changes[key]));
  //   }
  // }

  // chrome.storage.onChanged.addListener(function(changes, namespace) {
  //   if (changes["myValue"]) {
  //     valueChanged(changes["myValue"].newValue);
  //   }
  //   debugChanges(changes, namespace);
  // });

  // chrome.storage.sync.get("myValue", function(val) {valueChanged(val.myValue)});

})(jQuery);
