define([
    'jquery',
    'underscore',
    'backbone',
    'moment',
    'iznik/base',
    'iznik/views/pages/pages',
    'jquery-show-first'
], function($, _, Backbone, moment, Iznik) {
    Iznik.Views.ModTools.Message = Iznik.View.extend({
        rarelyUsed: function () {
            this.$('.js-rarelyused').fadeOut('slow');
            this.$('.js-stdmsgs li').fadeIn('slow');
        },

        restoreEditSubject: function () {
            var self = this;
            window.setTimeout(function () {
                self.$('.js-savesubj .glyphicon').removeClass('glyphicon-ok glyphicon-warning-sign error success').addClass('glyphicon-floppy-save');
            }, 30000);
        },

        editFailed: function () {
            console.log("Message edit failed");
            this.removeEditors();
            this.$('.js-savesubj .glyphicon').removeClass('glyphicon-refresh rotate').addClass('glyphicon-warning-sign error');
            this.restoreEditSubject();
        },

        editSucceeded: function () {
            console.log("Message edit succeeded");
            this.removeEditors();
            this.$('.js-savesubj .glyphicon').removeClass('glyphicon-refresh rotate').addClass('glyphicon-ok success');
            this.restoreEditSubject();
        },

        removeEditors: function () {
            for (var i = tinymce.editors.length - 1; i > -1; i--) {
                var ed_id = tinymce.editors[i].id;
                tinyMCE.execCommand("mceRemoveEditor", true, ed_id);
            }
            this.$('.js-tinymce').remove();
        },

        saveSubject: function () {
            var self = this;

            self.removeEditors();
            self.listenToOnce(self.model, 'editfailed', self.editFailed);
            self.listenToOnce(self.model, 'editsucceeded', self.editSucceeded);

            self.$('.js-savesubj .glyphicon').removeClass('glyphicon-floppy-save glyphicon-warning-sign').addClass('glyphicon-refresh rotate');

            self.listenToOnce(self.model, 'editsucceeded', function () {
                // If we've just edited, we don't want to display a diffferent subject in the edit box, as that's confusing.
                self.model.set('suggestedsubject', self.model.get('subject'));
                self.render();
            });

            var html = self.model.get('htmlbody');

            if (html) {
                // Yahoo is quite picky about the HTML that we pass back, and can fail edits.  Passing it through TinyMCE
                // to sanitise it works for this.
                self.$el.append('<textarea class="hidden js-tinymce" id="js-tinymce" />');
                self.$('.js-tinymce').val(html);
                tinyMCE.init({
                    selector: '.js-tinymce'
                });

                var html = tinyMCE.get('js-tinymce').getContent({format: 'raw'});
                self.model.set('htmlbody', html);
            }

            self.model.edit(
                self.$('.js-subject').val(),
                self.model.get('textbody'),
                self.model.get('htmlbody')
            );
        },

        viewSource: function (e) {
            e.preventDefault();
            e.stopPropagation();

            var v = new Iznik.Views.ModTools.Message.ViewSource({
                model: this.model
            });
            v.render();
        },

        excludeLocation: function (e) {
            var self = this;

            e.preventDefault();
            e.stopPropagation();

            if (self.model.get('location')) {
                var v = new Iznik.Views.PleaseWait({
                    timeout: 1
                });
                v.render();

                _.each(self.model.get('groups'), function (group) {
                    var groupid = group.groupid;
                    console.log("Exclude location", self.model.get('location').id);
                    $.ajax({
                        type: 'POST',
                        url: API + 'locations',
                        data: {
                            action: 'Exclude',
                            byname: true,
                            id: self.model.get('location').id,
                            groupid: groupid,
                            messageid: self.model.get('id')
                        }, success: function (ret) {
                            // We should have a new suggestion
                            self.model.fetch({
                                data: {
                                    groupid: groupid,
                                    collection: self.collectionType
                                }
                            }).then(function () {
                                console.log("New location", self.model.get('location').id);
                                self.render();
                            });

                            v.close();
                        }
                    });
                });
            }
        },

        showDuplicates: function () {
            var self = this;

            // Decide if we need to check for duplicates.
            var check = false;
            var groups = Iznik.Session.get('groups');
            var dupage = 31;
            _.each(self.model.get('groups'), function (group) {
                var dupsettings = Iznik.Session.getSettings(group.groupid);
                if (!dupsettings || !dupsettings.hasOwnProperty('duplicates') || dupsettings.duplicates.check) {
                    check = true;
                    var type = self.model.get('type');
                    dupage = Math.min(dupage, dupsettings.hasOwnProperty('duplicates') ? dupsettings.duplicates[type.toLowerCase()] : 31);
                }
            });

            var dups = [];
            var crossposts = [];

            if (check) {
                var id = self.model.get('id');
                var subj = canonSubj(self.model.get('subject'));

                _.each(self.model.get('groups'), function (group) {
                    var groupid = group.groupid;
                    var fromuser = self.model.get('fromuser');

                    if (fromuser) {
                        _.each(fromuser.messagehistory, function (message) {
                            message.dupage = dupage;

                            //console.log("Check message", message.id, id, message.daysago, canonSubj(message.subject), subj);
                            if (message.id != id && message.daysago < 60) {
                                if (canonSubj(message.subject) == subj) {
                                    // No point displaying any group tag in the duplicate.
                                    message.subject = message.subject.replace(/\[.*\](.*)/, "$1");

                                    if (message.groupid == groupid) {
                                        // Same group - so this is a duplicate
                                        var v = new Iznik.Views.ModTools.Message.Duplicate({
                                            model: new Iznik.Model(message)
                                        });
                                        self.$('.js-duplist').append(v.render().el);

                                        dups.push(message);
                                    } else {
                                        // Different group - so this is a crosspost.
                                        //
                                        // Get the group details for the template.
                                        message.group = Iznik.Session.getGroup(message.groupid).attributes;

                                        var v = new Iznik.Views.ModTools.Message.Crosspost({
                                            model: new Iznik.Model(message)
                                        });
                                        self.$('.js-crosspostlist').append(v.render().el);

                                        crossposts.push(message);
                                    }
                                }
                            }
                        });
                    }
                });
            }

            self.model.set('duplicates', dups);
            self.model.set('crossposts', crossposts);
        },

        checkMessage: function (config) {
            var self = this;

            this.showDuplicates();

            // We colour code subjects according to a regular expression in the config.
            this.$('.js-coloursubj').addClass('success');

            if (config.get('coloursubj')) {
                var subjreg = config.get('subjreg');

                if (subjreg) {
                    var re = new RegExp(subjreg);

                    if (!re.test(this.model.get('subject'))) {
                        this.$('.js-coloursubj').removeClass('success').addClass('error');
                    }
                }
            }
        },

        showRelated: function () {
            var self = this;

            _.each(self.model.get('related'), function (related) {
                // No point displaying any group tag in the duplicate.
                related.subject = related.subject.replace(/\[.*\](.*)/, "$1");

                var v = new Iznik.Views.ModTools.Message.Related({
                    model: new Iznik.Model(related)
                });
                self.$('.js-relatedlist').append(v.render().el);
            });
        },

        addOtherInfo: function () {
            var self = this;
            var fromemail = self.model.get('envelopefrom') ? self.model.get('envelopefrom') : self.model.get('fromaddr');

            // Add any other emails
            self.$('.js-otheremails').empty();
            var fromuser = self.model.get('fromuser');

            if (fromuser) {
                _.each(fromuser.emails, function (email) {
                    if (email.email != fromemail) {
                        var mod = new Iznik.Model(email);
                        var v = new Iznik.Views.ModTools.Message.OtherEmail({
                            model: mod
                        });
                        self.$('.js-otheremails').append(v.render().el);
                    }
                });

                // Add any other group memberships we need to display.
                self.$('.js-memberof').empty();
                var groupids = [self.model.get('groupid')];
                _.each(fromuser.memberof, function (group) {
                    if (groupids.indexOf(group.id) == -1) {
                        var mod = new Iznik.Model(group);
                        var v = new Iznik.Views.ModTools.Member.Of({
                            model: mod
                        });
                        self.$('.js-memberof').append(v.render().el);
                        groupids.push(group.id);
                    }
                });

                self.$('.js-applied').empty();
                _.each(fromuser.applied, function (group) {
                    if (groupids.indexOf(group.id) == -1) {
                        // Don't both displaying applications to groups we've just listed as them being a member of.
                        var mod = new Iznik.Model(group);
                        var v = new Iznik.Views.ModTools.Member.Applied({
                            model: mod
                        });
                        self.$('.js-applied').append(v.render().el);
                    }
                });

                // Don't show too many
                self.$('.js-memberof').showFirst({
                    controlTemplate: '<div><span class="badge">+[REST_COUNT] more</span>&nbsp;<a href="#" class="show-first-control">show</a></div>',
                    count: 5
                });
                self.$('.js-applied').showFirst({
                    controlTemplate: '<div><span class="badge">+[REST_COUNT] more</span>&nbsp;<a href="#" class="show-first-control">show</a></div>',
                    count: 5
                });
                self.$('.js-otheremails').showFirst({
                    controlTemplate: '<div><span class="badge">+[REST_COUNT] more</span>&nbsp;<a href="#" class="show-first-control">show</a></div>',
                    count: 5
                });
            }
        },

        wordify: function (str) {
            str = str.replace(/\b(\w*)/g, "<span>$1</span>");
            return (str);
        },

        spam: function () {
            var self = this;

            _.each(self.model.get('groups'), function (group) {
                var groupid = group.groupid;
                $.ajax({
                    type: 'POST',
                    url: API + 'message',
                    data: {
                        action: 'Spam',
                        id: self.model.get('id'),
                        groupid: groupid
                    }
                });
            });

            self.model.collection.remove(self.model);
        }
    });

    Iznik.Views.ModTools.Message.OtherEmail = Iznik.View.extend({
        template: 'modtools_message_otheremail'
    });

    Iznik.Views.ModTools.Message.Photo = Iznik.View.extend({
        tagName: 'li',

        template: 'modtools_message_photo',

        events: {
            'click .js-img': 'click'
        },

        click: function (e) {
            e.preventDefault();
            e.stopPropagation();

            var v = new Iznik.Views.Modal({
                model: this.model
            });

            v.open('modtools_message_photozoom');
        }
    });

    Iznik.Views.ModTools.StdMessage.Modal = Iznik.Views.Modal.extend({
        recentDays: 31,

        keywordList: ['Offer', 'Taken', 'Wanted', 'Received', 'Other'],

        expand: function () {
            var self = this;

            this.$el.html(window.template(this.template)(this.model.toJSON2()));

            // Apply standard message settings.  Need to refetch as the textbody is not returned in the session.
            if (this.options.stdmsg && this.options.stdmsg.get('id')) {
                this.options.stdmsg.fetch().then(function () {
                    var stdmsg = self.options.stdmsg.attributes;
                    var config = self.options.config ? self.options.config.attributes : null;

                    var subj = self.model.get('subject');

                    if (subj) {
                        // We have a pre-existing subject to include
                        subj = (stdmsg.subjpref ? stdmsg.subjpref : 'Re') + ': ' + subj +
                            (stdmsg.subjsuff ? stdmsg.subjsuff : '')
                        subj = self.substitutionStrings(subj, self.model.attributes, config, self.model.get('groups')[0]);
                        focuson = 'js-text';
                    } else {
                        // Just expand substitutions in the stdmsg.
                        subj = (stdmsg.subjpref ? stdmsg.subjpref : '') + (stdmsg.subjsuff ? stdmsg.subjsuff : '');
                        subj = self.substitutionStrings(subj, self.model.attributes, config, self.model.get('groups')[0]);
                        focuson = 'js-subject';
                    }

                    self.$('.js-subject').val(subj);

                    // Decide who the mail will look as though it comes from.
                    var name = Iznik.Session.get('me').displayname;
                    if (config && config.fromname == 'Groupname Moderator') {
                        name = self.model.get('groups')[0].nameshort + " Moderator";
                    }

                    self.$('.js-myname').html(name);

                    // Quote original message.
                    var msg = self.model.get('textbody');

                    if (msg) {
                        // We have an existing body to include.
                        msg = '> ' + msg.replace(/((\r\n)|\r|\n)/gm, '\n> ');

                        // Add text
                        msg = (stdmsg.body ? (stdmsg.body + '\n\n') : '') + msg;

                        // Expand substitution strings in body
                        msg = self.substitutionStrings(msg, self.model.attributes, config, self.model.get('groups')[0]);
                    } else if (stdmsg) {
                        // Just expand substitutions in the stdmsg.
                        msg = self.substitutionStrings(stdmsg.body, self.model.attributes, config, self.model.get('groups')[0]);
                    }

                    // Put it in
                    self.$('.js-text').val(msg);

                    self.open(null);
                    $('.modal').on('shown.bs.modal', function () {
                        $('.modal ' + focuson).focus();
                    });

                    if (self.options.stdmsg.get('autosend')) {
                        self.$('.js-send').click();
                    }
                });
            } else {
                // No standard message; just quote and open
                var subj = self.model.get('subject');
                subj = 'Re: ' + self.substitutionStrings(subj, self.model.attributes, null, self.model.get('groups')[0]);
                self.$('.js-subject').val(subj);

                // Decide who the mail will look as though it comes from.
                var name = Iznik.Session.get('me').displayname;
                self.$('.js-myname').html(name);

                // Quote original message.
                var msg = self.model.get('textbody');

                if (msg) {
                    // We have an existing body to include.
                    msg = '> ' + msg.replace(/((\r\n)|\r|\n)/gm, '\n> ');

                    // Expand substitution strings in body
                    msg = self.substitutionStrings(msg, self.model.attributes, null, self.model.get('groups')[0]);
                } else {
                    // Just expand substitutions in the stdmsg.
                    msg = self.substitutionStrings(stdmsg.body, self.model.attributes, null, self.model.get('groups')[0]);
                }

                // Put it in
                self.$('.js-text').val(msg);

                self.open(null);
            }

            self.closeWhenRequired();
        },

        substitutionStrings: function (text, model, config, group) {
            //console.log("substitutionstrings", text, model, config, group);
            var self = this;

            if (!_.isUndefined(text) && text) {
                if (config) {
                    text = text.replace(/\$networkname/g, config.network);
                    text = text.replace(/\$groupnonetwork/g, group.nameshort.replace(config.network, ''));
                }

                text = text.replace(/\$groupname/g, group.nameshort);
                text = text.replace(/\$owneremail/g, group.nameshort + "-owner@yahoogroups.com");
                text = text.replace(/\$groupemail/g, group.nameshort + "@yahoogroups.com");
                text = text.replace(/\$groupurl/g, "https://groups.yahoo.com/neo/groups/" + group.nameshort + "/info");
                text = text.replace(/\$myname/g, Iznik.Session.get('me').displayname);
                text = text.replace(/\$nummembers/g, group.membercount);
                text = text.replace(/\$nummods/g, group.nummods);

                text = text.replace(/\$origsubj/g, model.subject);

                if (model.fromuser) {
                    var history = model.fromuser.messagehistory;
                    var recentmsg = '';
                    var count = 0;
                    _.each(history, function (msg) {
                        if (msg.daysago < self.recentDays) {
                            recentmsg += moment(msg.date).format('lll') + ' - ' + msg.subject + "\n";
                            count++;
                        }
                    })
                    text = text.replace(/\$recentmsg/gim, recentmsg);
                    text = text.replace(/\$numrecentmsg/gim, count);
                }

                _.each(this.keywordList, function (keyword) {
                    var recentmsg = '';
                    var count = 0;
                    _.each(history, function (msg) {
                        if (msg.type == keyword && msg.daysago < self.recentDays) {
                            recentmsg += moment(msg.date).format('lll') + ' - ' + msg.subject + "\n";
                            count++;
                        }
                    })

                    text = text.replace(new RegExp('\\$recent' + keyword.toLowerCase(), 'gim'), recentmsg);
                    text = text.replace(new RegExp('\\$numrecent' + keyword.toLowerCase(), 'gim'), count);
                });

                text = text.replace(/\$memberreason/g, model.hasOwnProperty('joincomment') ? model.joincomment : '');

                if (model.hasOwnProperty('joined')) {
                    text = text.replace(/\$membersubdate/g, moment(model.joined).format('lll'));
                }

                // TODO $otherapplied

                text = text.replace(/\$membermail/g, model.fromaddr);
                var from = model.fromuser.hasOwnProperty('realemail') ? model.fromuser.realemail : model.fromaddr;
                var fromid = from.substring(0, from.indexOf('@'));
                var memberid = presdef('yahooid', model.fromuser, fromid);
                text = text.replace(/\$memberid/g, fromid);

                var summ = '';

                if (model.hasOwnProperty('duplicates')) {
                    _.each(model.duplicates, function (m) {
                        summ += moment(m.date).format('lll') + " - " + m.subject + "\n";
                    });

                    var regex = new RegExp("\\$duplicatemessages", "gim");
                    text = text.replace(regex, summ);
                }
            }

            return (text);
        },

        maybeSettingsChange: function (trigger, stdmsg, message, group) {
            var self = this;

            var dt = stdmsg.get('newdelstatus');
            var ps = stdmsg.get('newmodstatus');

            if (dt != 'UNCHANGED') {
                $.ajax({
                    type: 'POST',
                    headers: {
                        'X-HTTP-Method-Override': 'PATCH'
                    },
                    url: API + 'user',
                    data: {
                        groupid: group.groupid,
                        id: message.get('fromuser').id,
                        yahooDeliveryType: dt
                    }, success: function (ret) {
                        IznikPlugin.checkPluginStatus();
                    }
                });
            }

            if (ps != 'UNCHANGED') {
                $.ajax({
                    type: 'POST',
                    headers: {
                        'X-HTTP-Method-Override': 'PATCH'
                    },
                    url: API + 'user',
                    data: {
                        groupid: group.groupid,
                        id: message.get('fromuser').id,
                        yahooPostingStatus: ps
                    }, success: function (ret) {
                        IznikPlugin.checkPluginStatus();
                    }
                });
            }

            self.trigger(trigger);
            self.close();
        },

        closeWhenRequired: function () {
            var self = this;

            // If the underlying message is approved, rejected or deleted then:
            // - we may have actions to complete
            // - this modal should close.
            self.listenToOnce(self.model, 'approved', function () {
                _.each(self.model.get('groups'), function (group, index, list) {
                    self.maybeSettingsChange.call(self, 'approved', self.options.stdmsg, self.model, group);
                });
                self.close();
            });

            self.listenToOnce(self.model, 'rejected', function () {
                _.each(self.model.get('groups'), function (group, index, list) {
                    self.maybeSettingsChange.call(self, 'rejected', self.options.stdmsg, self.model, group);
                });
                self.close();
            });

            self.listenToOnce(self.model, 'deleted', function () {
                _.each(self.model.get('groups'), function (group, index, list) {
                    self.maybeSettingsChange.call(self, 'deleted', self.options.stdmsg, self.model, group);
                });
                self.close();
            });

            self.listenToOnce(self.model, 'replied', function () {
                _.each(self.model.get('groups'), function (group, index, list) {
                    self.maybeSettingsChange.call(self, 'replied', self.options.stdmsg, self.model, group);
                });
                self.close();
            });
        }
    });


    Iznik.Views.ModTools.Message.ViewSource = Iznik.Views.Modal.extend({
        template: 'modtools_messages_pending_viewsource',

        render: function () {
            var self = this;
            this.open(this.template);

            // Fetch the individual message, which gives us access to the full message (which isn't returned
            // in the normal messages call to save bandwidth.
            var m = new Iznik.Models.Message({
                id: this.model.get('id')
            });

            m.fetch().then(function () {
                self.$('.js-source').text(m.get('message'));
            });
            return (this);
        }
    });

    Iznik.Views.ModTools.StdMessage.Edit = Iznik.Views.Modal.extend({
        template: 'modtools_message_edit',

        events: function () {
            return _.extend({}, _.result(Iznik.Views.Modal, 'events'), {
                'click .js-save': 'save'
            });
        },

        save: function () {
            var self = this;

            self.$('.js-editfailed').hide();

            self.listenToOnce(self.model, 'editsucceeded', function () {
                self.close();
            });

            self.listenToOnce(self.model, 'editfailed', function () {
                self.$('.js-editfailed').fadeIn('slow');
            });

            var html = tinyMCE.activeEditor.getContent({format: 'raw'});
            var text = tinyMCE.activeEditor.getContent({format: 'text'});

            self.model.edit(
                self.$('.js-subject').val(),
                text,
                html
            );
        },

        expand: function () {
            var self = this;
            this.open(this.template, this.model);

            var body = self.model.get('htmlbody');
            body = body ? body : self.model.get('textbody');

            if (self.options.stdmsg) {
                var subjpref = self.options.stdmsg.get('subjpref');
                var subjsuff = self.options.stdmsg.get('subjsuff');
                var stdbody = self.options.stdmsg.get('body');

                if (stdbody) {
                    body = stdbody + '<br><br>' + body;
                }

                var subj = self.model.get('subject');

                if (subjpref) {
                    subj = subjpref + subj;
                }

                if (subjsuff) {
                    subj = subj + subjsuff;
                }

                self.$('.js-subject').val(subj);
            }

            if (self.options.stdmsg && self.options.stdmsg.get('edittext') == 'Correct Case') {
                body = body.toLowerCase();

                // Contentious choice of single space
                body = body.replace(/\.( |(&nbsp;))+/g, ". ");
                body = body.replace(/\.\n/g, ".[-<br>-]. ");
                body = body.replace(/\.\s\n/g, ". [-<br>-]. ");
                var wordSplit = '. ';
                var wordArray = body.split(wordSplit);
                var numWords = wordArray.length;

                for (x = 0; x < numWords; x++) {

                    if (!_.isUndefined(wordArray[x])) {
                        wordArray[x] = wordArray[x].replace(wordArray[x].charAt(0), wordArray[x].charAt(0).toUpperCase());

                        if (x == 0) {
                            body = wordArray[x] + ". ";
                        } else if (x != numWords - 1) {
                            body = body + wordArray[x] + ". ";
                        } else if (x == numWords - 1) {
                            body = body + wordArray[x];
                        }
                    }
                }

                body = body.replace(/\[-<br>-\]\.\s/g, "\n");
                body = body.replace(/\si\s/g, " I ");
                body = body.replace(/(\<p\>.)/i, function (a, b) {
                    return (b.toUpperCase());
                });
            }

            self.$('.js-text').val(body);

            tinymce.init({
                selector: '.js-text',
                height: 300,
                plugins: [
                    'advlist autolink lists link image charmap print preview anchor',
                    'searchreplace visualblocks code fullscreen',
                    'insertdatetime media table contextmenu paste code'
                ],
                menubar: 'edit insert format tools',
                statusbar: false,
                toolbar: 'bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image'
            });
        },

        render: function () {
            var self = this;

            if (self.options.stdmsg) {
                // Need to fetch as the body is excluded from what is returned in session.
                self.options.stdmsg.fetch().then(function () {
                    self.expand();
                });
            } else {
                self.expand();
            }
        }
    });

    Iznik.Views.ModTools.StdMessage.Button = Iznik.View.extend({
        template: 'modtools_message_stdmsg',

        tagName: 'li',

        className: 'js-stdbutton',

        events: {
            'click .js-approve': 'approve',
            'click .js-reject': 'reject',
            'click .js-delete': 'deleteMe',
            'click .js-hold': 'hold',
            'click .js-release': 'release',
            'click .js-leave': 'leave',
            'click .js-edit': 'edit'
        },

        hold: function () {
            var self = this;
            var message = self.model.get('message');
            var member = self.model.get('member');
            message ? message.hold() : member.hold();
        },

        release: function () {
            var self = this;
            var message = self.model.get('message');
            var member = self.model.get('member');
            message ? message.release() : member.release();
        },

        approve: function () {
            var self = this;
            var message = self.model.get('message');
            var member = self.model.get('member');

            if (this.options.config) {
                // This is a configured button; open the modal.
                var v = new Iznik.Views.ModTools.StdMessage.Pending.Approve({
                    model: message ? message : member,
                    stdmsg: this.model,
                    config: this.options.config
                });

                v.render();
            } else {
                // No popup to show.
                message ? message.approve() : member.approve();
            }
        },

        edit: function () {
            var self = this;
            var message = self.model.get('message');

            var v = new Iznik.Views.ModTools.StdMessage.Edit({
                model: message ? message : member,
                stdmsg: this.model,
                config: this.options.config
            });

            v.render();
        },

        reject: function () {
            var self = this;
            var message = self.model.get('message');
            var member = self.model.get('member');

            var v = new Iznik.Views.ModTools.StdMessage.Pending.Reject({
                model: message ? message : member,
                stdmsg: this.model,
                config: this.options.config
            });

            v.render();
        },

        leave: function () {
            var self = this;
            var message = self.model.get('message');
            var member = self.model.get('member');

            var v = new Iznik.Views.ModTools.StdMessage.Leave({
                model: message ? message : member,
                stdmsg: this.model,
                config: this.options.config
            });

            v.render();
        },

        deleteMe: function () {
            var self = this;
            var message = self.model.get('message');
            var member = self.model.get('member');

            if (this.options.config) {
                // This is a configured button; open the modal.
                var v = new Iznik.Views.ModTools.StdMessage.Delete({
                    model: message ? message : member,
                    stdmsg: this.model,
                    config: this.options.config
                });

                v.render();
            } else {
                var v = new Iznik.Views.Confirm({});

                self.listenToOnce(v, 'confirmed', function () {
                    message ? message.delete() : member.delete();
                });

                v.render();
            }
        }
    });

    Iznik.Views.ModTools.Message.Duplicate = Iznik.View.extend({
        template: 'modtools_message_duplicate',

        render: function () {
            var self = this;
            self.$el.html(window.template(self.template)(self.model.toJSON2()));
            this.$('.timeago').timeago();
            return (this);
        }
    });

    Iznik.Views.ModTools.Message.Crosspost = Iznik.View.extend({
        template: 'modtools_message_crosspost',

        render: function () {
            var self = this;
            self.$el.html(window.template(self.template)(self.model.toJSON2()));
            this.$('.timeago').timeago();
            return (this);
        }
    });

    Iznik.Views.ModTools.Message.Related = Iznik.View.extend({
        template: 'modtools_message_related',

        render: function () {
            var self = this;
            self.$el.html(window.template(self.template)(self.model.toJSON2()));
            this.$('.timeago').timeago();
            return (this);
        }
    });

    Iznik.Views.ModTools.StdMessage.Leave = Iznik.Views.ModTools.StdMessage.Modal.extend({
        template: 'modtools_message_leave',

        events: {
            'click .js-send': 'send'
        },

        send: function () {
            this.model.reply(
                this.$('.js-subject').val(),
                this.$('.js-text').val(),
                this.options.stdmsg.get('id')
            );
        },

        render: function () {
            this.expand();
            return (this);
        }
    });

    Iznik.Views.ModTools.StdMessage.Delete = Iznik.Views.ModTools.StdMessage.Modal.extend({
        template: 'modtools_message_delete',

        events: {
            'click .js-send': 'send'
        },

        send: function () {
            var self = this;
            this.listenToOnce(this.model, 'replied', function () {
                // We've sent the mail; now remove the message/member.
                // TODO Hacky - should we split stdmessages for message/members?
                if (typeof self.model.delete == 'function') {
                    self.model.delete();
                } else {
                    self.model.destroy();
                }
            });

            this.model.reply(
                this.$('.js-subject').val(),
                this.$('.js-text').val(),
                this.options.stdmsg.get('id')
            );
        },

        render: function () {
            this.expand();
            return (this);
        }
    });
});