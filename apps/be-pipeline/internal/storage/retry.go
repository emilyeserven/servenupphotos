package storage

import (
	"errors"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/ratelimit"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
)

// r2ReadAttempts is how many times a read from R2 is tried before its
// failure is shown: R2 now and then answers a request with a 500 (its
// InternalError, "retry the request") that works when asked again.
// https://developers.cloudflare.com/r2/api/error-codes/
const r2ReadAttempts = 3

// newR2Retryer asks R2 again, after a short wait, when a read (a GET or
// HEAD, such as reading the Square Thumbnail's crop) got a 5xx or 429 answer.
// Nothing else is retried: an upload's body may be a stream that can't be
// sent twice, and a wrong account ID or key fails the same way every time,
// so the Settings check still answers at once.
func newR2Retryer() aws.Retryer {
	return retry.NewStandard(func(o *retry.StandardOptions) {
		o.MaxAttempts = r2ReadAttempts
		o.MaxBackoff = 2 * time.Second
		o.Retryables = []retry.IsErrorRetryable{retry.IsErrorRetryableFunc(retryableR2Read)}
		o.Timeouts = nil
		o.Throttles = nil
		// One person's pipeline: no need to ration retries across requests.
		o.RateLimiter = ratelimit.None
	})
}

// retryableR2Read is whether err is a read R2 answered with a passing
// failure: a 5xx, or a 429 for asking too often.
func retryableR2Read(err error) aws.Ternary {
	var respErr *awshttp.ResponseError
	if !errors.As(err, &respErr) || respErr.Response == nil || respErr.Response.Response == nil {
		return aws.FalseTernary
	}
	if req := respErr.Response.Request; req == nil || (req.Method != http.MethodGet && req.Method != http.MethodHead) {
		return aws.FalseTernary
	}
	status := respErr.HTTPStatusCode()
	return aws.BoolTernary(status >= http.StatusInternalServerError || status == http.StatusTooManyRequests)
}
