define([
    'jquery',
    'underscore',
    'backbone',
    'iznik/base',
    'iznik/facebook',
    'iznik/views/modal',
    'iznik/google'
], function($, _, Backbone, Iznik, FBLoad) {
    Iznik.Views.SignInUp = Iznik.Views.Modal.extend({
        className: "signinup",

        signInShown: true,

        events: {
            'click .js-loginNative': 'showNative',
            'click .js-signin': 'signin',
            'click .js-signup': 'signup',
            'click .js-register': 'register',
            'click .js-already': 'already',
            'click .js-loginYahoo': 'yahoologin',
            'click .js-loginFB': 'fblogin',
            'click .js-forgot': 'lostPassword',
            'keyup .js-signinform': 'enterSubmit'
        },

        'enterSubmit': function (e) {
            switch (e.keyCode) {
                case 13: //enter
                    if (this.signInShown) {
                        this.signin();
                    } else {
                        this.signup();
                    }
                    break;
            }
        },

        register: function(e) {
            this.signInShown = false;
            this.$('.js-registerhide').hide();
            this.$('.js-signinerror').hide();
            this.$('.js-registershow').fadeIn('slow');
            this.$('.js-firstname').focus();
        },

        already: function(e) {
            this.signInShown = true;
            this.$('.js-registershow').hide();
            this.$('.js-signinerror').hide();
            this.$('.js-registerhide').fadeIn('slow');
            this.$('.js-email').focus();
        },

        signin: function () {
            var self = this;
            self.$('.js-signinerror').hide();

            try {
                localStorage.setItem('myemail', self.$('.js-signinform .js-email').val());
            } catch (e) {
            }

            $.ajax({
                type: "POST",
                url: API + "session",
                data: {
                    'email': self.$('.js-signinform .js-email').val(),
                    'password': self.$('.js-signinform .js-password').val()
                },
                success: function (ret) {
                    if (ret.ret == 0) {
                        // We're logged in.  Reload this page, and now that we are logged in the route
                        // should behave differently.
                        Backbone.history.loadUrl(); // CC
                    } else if (parseInt(ret.ret) == 2) {
                        self.$('.js-unknown').fadeIn('slow');
                    } else {
                        self.$('.js-signinerror .js-errmsg').html(ret.status);
                        self.$('.js-signinerror').fadeIn('slow');
                        Iznik.Session.trigger('loginFailed');
                    }
                },
                error: function () {
                    self.$('.js-signinerror .js-errmsg').val('Sorry, something went wrong.  Please try later.');
                    self.$('.js-signinerror').fadeIn('slow');
                    Iznik.Session.trigger('loginFailed');
                }
            });
        },

        signup: function () {
            var self = this;
            self.$('.js-signinerror').hide();
            $.ajax({
                type: "PUT",
                url: API + "user",
                data: {
                    'firstname': self.$('.js-firstname').val(),
                    'lastname': self.$('.js-lastname').val(),
                    'email': self.$('.js-email').val(),
                    'password': self.$('.js-password').val()
                },
                success: function (ret) {
                    if (parseInt(ret.ret) == 0) {
                        // We're logged in.  Reload this page, and now that we are logged in the route
                        // should behave differently.
                        Backbone.history.loadUrl(); // CC
                    } else {
                        self.$('.js-signuperror .js-errmsg').html(ret.status);
                        self.$('.js-signuperror').fadeIn('slow');
                    }
                },
                error: function () {
                    self.$('.js-signuperror .js-errmsg').val('Sorry, something went wrong.  Please try later.');
                    self.$('.js-signuperror').fadeIn('slow');
                    Iznik.Session.trigger('loginFailed');
                }
            });
        },

        fblogin: function () {
            var self = this;

            var FBLoad = new Iznik.Views.FBLoad();
            FBLoad.signin();
        },
        
        yahoologin: function () {
            this.listenToOnce(Iznik.Session, 'yahoologincomplete', function (ret) {
                if (ret.hasOwnProperty('redirect')) {
                    window.location = ret.redirect;
                } else if (ret.ret == 0) {
                    window.location.reload();
                } else {
                    window.location.reload();
                }
            });

            Iznik.Session.yahooLogin();
        },

        showNative: function () {
            this.$('.js-buttons').hide();
            this.$('.js-native').show();

            try {
                var email = localStorage.getItem('myemail');
                if (email) {
                    self.$('.js-email').val(email);
                }
            } catch (e) {
            }
        },

        lostPassword: function (e) {
            e.preventDefault();
            console.log("Lost password");
            var v = new Iznik.Views.SignInUp.LostPassword();
            v.render();
        },

        render: function () {
            var self = this;
            this.template = this.options.modtools ? "signinup_modtools" : "signinup_user";
            var p = this.open(this.template, null);
            p.then(function() {
                self.$('.js-native').hide();

                // We do a trick with submitting to a hidden iframe to make browsers save the password.  If there was
                // one, it'll have been restored by the browser on page load. Move it into our form now.
                self.$('.js-email').val($('#hiddenloginemail').val());
                self.$('.js-password').val($('#hiddenloginpassword').val());

                try {
                    var ever = localStorage.getItem('signedinever');
                    if (ever) {
                        self.already();
                    } else {
                        self.register();
                    }

                } catch (e) {
                }

                $('.js-privacy').hide();
                $('.js-signin-msg').hide(); // CC
                
                self.$('.js-loginFB').removeClass('signindisabled');  // CC

                // Load the Google API
                var GoogleLoad = new Iznik.Views.GoogleLoad();

                // We have a custom signin button which needs googleising.
                GoogleLoad.signInButton('gConnect');
                
            });

            return (p);
        }
    });

    Iznik.Views.SignInUp.Result = Iznik.Views.Modal.extend({
        template: 'signinup_result'
    });

    Iznik.Views.CookieError = Iznik.Views.Modal.extend({
        template: 'signinup_cookies'
    });
    
    Iznik.Views.SignInUp.LostPassword = Iznik.Views.Modal.extend({
        template: 'signinup_lostpassword',
        
        events: {
            'click .js-send': 'send'
        },
        
        send: function() {
            var self = this;
            var email = self.$('.js-email').val();
            if (email.length == 0) {
                self.$('.js-email').focus();
            } else {
                $.ajax({
                    url: API + 'session',
                    type: 'POST',
                    data: {
                        action: 'LostPassword',
                        email: email
                    }, success: function (ret) {
                        var v = new Iznik.Views.SignInUp.LostPassword.Result();
                        v.render();
                    }
                })
            }
        },

        render: function() {
            var self = this;

            Iznik.Views.Modal.prototype.render.call(this).then(function() {
                try {
                    var email = localStorage.getItem('myemail');
                    if (email) {
                        self.$('.js-email').val(email);
                    }
                } catch (e) {
                }
            })
        }
    });

    Iznik.Views.SignInUp.LostPassword.Result = Iznik.Views.Modal.extend({
        template: 'signinup_lostpasswordresult'
    });
});