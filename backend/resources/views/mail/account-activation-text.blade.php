Welcome, {{ $name }}

An account has been created for you at {{ config('app.name', 'Cove School') }}.
Your login ID (system email) is: {{ $systemEmail }}

To set your password and activate your account, open this link:
{{ $activationUrl }}

This link expires in {{ \App\Services\ActivationService::TOKEN_TTL_HOURS }} hours and can only be used once.

If you did not expect this message, you can ignore it.
