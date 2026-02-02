variable "resource_group_name" {
  description = "Name of the Resource Group"
  type        = string
  default     = "vxt-rg"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "westeurope"
}
