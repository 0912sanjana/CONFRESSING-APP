$RandomDir = "$env:TEMP\kiit-backend-target-$(Get-Random)"
$env:CARGO_TARGET_DIR = $RandomDir
cargo run
