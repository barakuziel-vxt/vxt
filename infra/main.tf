terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
  required_version = ">= 1.3.0"
}

provider "azurerm" {
  features {}
}

# Resource Group
resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
}

# Storage account for function app
resource "azurerm_storage_account" "sa" {
  name                     = lower("vxtsa${random_id.sa.hex}")
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

# Random suffix
resource "random_id" "sa" {
  byte_length = 2
}

output "resource_group" {
  value = azurerm_resource_group.rg.name
}
