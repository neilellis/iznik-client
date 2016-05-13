<?php
$scriptstart = microtime(false);
header('Access-Control-Allow-Origin: *');
date_default_timezone_set('UTC');
session_start();
define( 'BASE_DIR', dirname(__FILE__) . '/..' );
require_once(BASE_DIR . '/include/config.php');
require_once(IZNIK_BASE . '/include/utils.php');
require_once(IZNIK_BASE . '/include/db.php');
require_once(IZNIK_BASE . '/include/session/Yahoo.php');
require_once(IZNIK_BASE . '/include/user/User.php');
require_once(IZNIK_BASE . "/lib/JSMin.php");

global $dbhr, $dbhm;

if (pres('REQUEST_URI', $_SERVER) == 'yahoologin') {
    # We have been redirected here from Yahoo.  Time to try to log in while we still have the
    # OAUTH data in our parameters (which won't be the case on subsequent API calls).
    #error_log("Redirect from Yahoo");
    $y = new Yahoo($dbhr, $dbhm);

    # No need to pay attention to the result - whether it worked or not will be determined by the
    # client later.
    $y->login(get_current_url());
}
include_once(BASE_DIR . '/include/misc/pageheader.php');

# Depending on rewrites we might not have set up $_REQUEST.
if (strpos($_SERVER['REQUEST_URI'], '?') !== FALSE) {
    list($path, $qs) = explode("?", $_SERVER["REQUEST_URI"], 2);
    parse_str($qs, $qss);
    $_REQUEST = array_merge($_REQUEST, $qss);
}

# Check if we are fetching this url with a key which allows us to auto-login a user.
$uid = presdef('u', $_REQUEST, NULL);
$key = presdef('k', $_REQUEST, NULL);
if ($uid && $key) {
    $u = new User($dbhr, $dbhm, $uid);
    $u->linkLogin($key);
}

?>
<body style="background-colour: #dff2d1;">
<noscript>
    <h1>Please enable Javascript</h1>

    <p>We'd love to do a version
        which was accessible to people who don't use Javascript, but we do not have the volunteer resources to do that.
        If you'd like to help with skills or funding, please <a href="mailto:edward@ehibbert.org.uk">mail us</a>.</p>
</noscript>
<div id="pageloader" style="position: relative; height: 100%; width: 100%">
    <img src="/images/pageloader.gif" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; margin: auto;"/>
</div>
<div id="fb-root"></div>
<div id="bodyEnvelope">
    <div id="bodyContent" class="nopad">
    </div>
</div>
</body>
</html>
