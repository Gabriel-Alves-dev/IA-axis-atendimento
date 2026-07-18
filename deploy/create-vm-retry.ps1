# Fica tentando criar a VM Ampere A1 (Always Free) até a Oracle liberar capacidade
# na região sa-saopaulo-1. Rode num PowerShell que você possa deixar aberto —
# pode minimizar a janela, mas não fechar.
#
# Uso: powershell -ExecutionPolicy Bypass -File deploy\create-vm-retry.ps1

$ErrorActionPreference = "Continue"
$env:PATH += ";$env:USERPROFILE\bin"
$env:OCI_CLI_SUPPRESS_FILE_PERMISSIONS_WARNING = "True"

$tenancyId   = (Get-Content "$env:USERPROFILE\.oci\config" | Select-String "^tenancy=") -replace "tenancy=", ""
$compartmentId = $tenancyId  # conta simples: compartment raiz = tenancy
$availabilityDomain = "vbQD:SA-SAOPAULO-1-AD-1"
$subnetId    = "ocid1.subnet.oc1.sa-saopaulo-1.aaaaaaaacb53qirwpmk6jakzqbh2v4eidpeuk7ir3ljwzpqx26itmt6wrcjq"
$imageId     = "ocid1.image.oc1.sa-saopaulo-1.aaaaaaaawvmdar75jvnrck56qxxqli2oafzdqc2wxadcnnr7zzis6fafd3dq"  # Ubuntu 24.04 aarch64 mais recente
$sshKeyPath  = "C:\Users\trabs\.ssh\id_ed25519.pub"
$instanceName = "axis-atendimento-vm"

$attempt = 0
while ($true) {
    $attempt++
    $now = Get-Date -Format "HH:mm:ss"
    Write-Host "[$now] Tentativa $attempt..." -ForegroundColor Cyan

    try {
        $result = oci compute instance launch `
            --compartment-id $compartmentId `
            --availability-domain $availabilityDomain `
            --shape "VM.Standard.A1.Flex" `
            --shape-config "{\`"ocpus\`":2,\`"memoryInGBs\`":12}" `
            --image-id $imageId `
            --subnet-id $subnetId `
            --assign-public-ip true `
            --display-name $instanceName `
            --ssh-authorized-keys-file $sshKeyPath `
            --boot-volume-size-in-gbs 50 `
            --wait-for-state RUNNING `
            --max-wait-seconds 120 2>&1 | Out-String
    }
    catch {
        $result = $_ | Out-String
    }

    if ($result -match '"lifecycle-state":\s*"RUNNING"' -or $result -match "Action completed") {
        Write-Host ""
        Write-Host "=== VM CRIADA COM SUCESSO na tentativa $attempt ===" -ForegroundColor Green
        Write-Host $result
        # Toca um beep pra avisar mesmo se a janela estiver minimizada
        [console]::beep(1000, 400)
        [console]::beep(1200, 400)
        break
    }
    elseif ($result -match "Out of capacity" -or $result -match "Out of host capacity") {
        Write-Host "  Sem capacidade ainda. Aguardando 3 minutos..." -ForegroundColor Yellow
    }
    else {
        Write-Host "  Erro inesperado:" -ForegroundColor Red
        Write-Host $result
        Write-Host "  Aguardando 3 minutos antes de tentar de novo (Ctrl+C pra parar e investigar)..." -ForegroundColor Yellow
    }

    Start-Sleep -Seconds 180
}
