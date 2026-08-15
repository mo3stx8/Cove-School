<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f3f4f6; color: #111827; margin: 0; padding: 24px; }
        .card { max-width: 480px; margin: 24px auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; }
        h1 { font-size: 20px; margin: 0 0 12px; }
        p { line-height: 1.6; color: #374151; }
        .btn { display: inline-block; margin: 16px 0; padding: 12px 20px; background: #2563eb; color: #ffffff; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .meta { font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; margin-top: 20px; padding-top: 12px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Welcome, {{ $name }}</h1>
        <p>
            An account has been created for you at <strong>{{ config('app.name', 'Cove School') }}</strong>.
            Your login ID (system email) is:
        </p>
        <p><strong>{{ $systemEmail }}</strong></p>
        <p>Click the button below to set your password and activate your account:</p>
        <a class="btn" href="{{ $activationUrl }}">Activate Account</a>
        <p>This link expires in {{ \App\Services\ActivationService::TOKEN_TTL_HOURS }} hours and can only be used once.</p>
        <div class="meta">If you did not expect this message, you can ignore it.</div>
    </div>
</body>
</html>
