# ==========================================
# ArgusNode OS - Azure Infrastructure Script
# ==========================================

$ResourceGroup = "ArgusNode-RG-Spain"
$Location = "spaincentral" # España Central (Madrid)
$WinVMName = "Argus-Win-01"
$AdminUsername = "argusadmin"

Write-Host "Iniciando despliegue de Infraestructura Cloud Híbrida para ArgusNode OS..." -ForegroundColor Cyan

# 1. Comprobar autenticación en Azure
$loggedIn = az account show --query "name" -o tsv 2>$null
if (-not $loggedIn) {
    Write-Host "No estás logado en Azure. Se abrirá el navegador para autenticarte..." -ForegroundColor Yellow
    az login | Out-Null
}

$Subscription = az account show --query "name" -o tsv
Write-Host "Suscripción activa: $Subscription" -ForegroundColor Green

# 2. Crear el Grupo de Recursos (Resource Group)
Write-Host "Creando Resource Group [$ResourceGroup] en [$Location]..."
az group create --name $ResourceGroup --location $Location | Out-Null

# 3. Pedir contraseña para Windows de forma segura
Write-Host ""
Write-Host 'ATENCION: La contrasena de Windows DEBE cumplir 3 de las 4 siguientes reglas:' -ForegroundColor Red
Write-Host '1. Una mayuscula, 2. Una minuscula, 3. Un numero, 4. Un caracter especial (!@#$%)' -ForegroundColor Yellow
Write-Host 'Y debe tener entre 12 y 123 caracteres.' -ForegroundColor Yellow
$WinPassword = Read-Host -AsSecureString 'Introduce una contrasena segura para el Servidor Windows'
$WinPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($WinPassword))
Write-Host ""

# 4. Desplegar Máquina Windows Server
Write-Host "Desplegando $WinVMName (Windows Server 2022)... Esto puede tardar varios minutos." -ForegroundColor Yellow
az vm create `
    --resource-group $ResourceGroup `
    --name $WinVMName `
    --image Win2022Datacenter `
    --admin-username $AdminUsername `
    --admin-password $WinPasswordPlain `
    --public-ip-sku Standard `
    --size Standard_B2s `
    --storage-sku StandardSSD_LRS
Write-Host "[OK] Windows VM Creada." -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "¡Despliegue Cloud Completado con Éxito!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Credenciales para Escritorio Remoto (RDP):"
Write-Host "Usuario: $AdminUsername"
Write-Host "Contraseña: (La que has introducido)"
