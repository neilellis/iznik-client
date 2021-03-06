var Raven = require('raven-js');

function panicReload() {
    // This is used when we fear something has gone wrong with our fetching of the code, and want to bomb out and
    // reload from scratch.
    console.error("Panic and reload");
    try {
        // If we have a service worker, tell it to clear its cache in case we have bad scripts.
        navigator.serviceWorker.controller.postMessage({
            type: 'clearcache'
        });
    } catch (e) {}

    window.setTimeout(function() {
        window.location.reload();
    }, 1000);
}

Raven.context(function() {
    require([
        'jquery',
        'underscore',
        'backbone',
        'iznik/router'
    ], function($, _, Backbone) {
        if (!Backbone) {
            // Something has gone unpleasantly wrong.
            console.error("Backbone failed to fetch");
            panicReload();
        }

        try {
            Backbone.emulateJSON = true;

            // We have a busy indicator.
            $(document).ajaxStop(function () {
                $('#spinner').hide();

                // We might have added a class to indicate that we were waiting for an AJAX call to complete.
                $('.showclicked').removeClass('showclicked');
            });

            $(document).ajaxStart(function () {
                $('#spinner').show();
            });

            // We want to retry AJAX requests automatically, because we might have a flaky network.  This also covers us for
            // Backbone fetches.
            var _ajax = $.ajax;

            function sliceArgs() {
                return(Array.prototype.slice.call(arguments, 0));
            }

            function delay(errors) {
                // Exponential backoff upto a limit.
                return(Math.min(Math.pow(2, errors) * 1000, 30000));
            }

            function retryIt(jqXHR) {
                var self = this;
                this.errors = this.errors === undefined ? 0 : this.errors + 1;
                var thedelay = delay(this.errors);
                console.log("retryIt", thedelay, this, arguments);
                setTimeout(function () {
                    $.ajax(self);
                }, thedelay);
            }

            function extendIt(args, options) {
                _.extend(args[0], options && typeof options === 'object' ? options : {}, {
                    error:   function (event, xhr) {
                        if (xhr.statusText === 'abort') {
                            console.log("Aborted, don't retry");
                        } else {
                            retryIt.apply(this, arguments);
                        }
                    }
                });
            }

            $.ajax = function (options) {
                var url = options.url;

                // There are some cases we don't want to subject to automatic retrying:
                // - Yahoo can validly return errors as part of its API, and we handle retrying via the plugin work.
                // - Where the context is set to a different object, we'd need to figure out how to implement the retry.
                // - File uploads, because we might have cancelled it.
                if (!options.hasOwnProperty('context') && url && url.indexOf('groups.yahoo.com') == -1 && url != API + 'upload') {
                    // We wrap the AJAX call in our own, with our own error handler.
                    var args;
                    if (typeof options === 'string') {
                        arguments[1].url = options;
                        args = sliceArgs(arguments[1]);
                    } else {
                        args = sliceArgs(arguments);
                    }

                    extendIt(args, options);

                    return _ajax.apply($, args);
                } else {
                    return(_ajax.apply($, arguments));
                }
            };

            // Bootstrap adds body padding which we don't want.
            $('body').css('padding-right', '');
        } catch(e) {
            Raven.captureException(e);
        }
    });
});

