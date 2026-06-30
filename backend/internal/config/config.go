package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	MySQLDSN         string
	Port             string
	AnthropicAPIKey  string
	AnthropicBaseURL string
	AnthropicModel   string
}

func Load() Config {
	godotenv.Load("../.env")

	return Config{
		MySQLDSN:         getEnv("MYSQL_DSN", "root:root@tcp(localhost:3306)/jobscout_dev?parseTime=true&charset=utf8mb4&multiStatements=true"),
		Port:             getEnv("PORT", "8080"),
		AnthropicAPIKey:  getEnv("ANTHROPIC_API_KEY", ""),
		AnthropicBaseURL: getEnv("ANTHROPIC_BASE_URL", ""),
		AnthropicModel:   getEnv("ANTHROPIC_MODEL", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
