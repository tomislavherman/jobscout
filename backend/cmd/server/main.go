package main

import (
	"log"
	"net/http"
	"time"

	"jobscout/internal/config"
	"jobscout/internal/db"
	"jobscout/internal/llm"
	"jobscout/internal/server"
	svc "jobscout/internal/sync"
)

func main() {
	cfg := config.Load()

	database, err := db.Connect(cfg.MySQLDSN)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	if err := db.RunMigrations(database); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	llmClient := llm.NewClient(llm.Config{
		APIKey:  cfg.AnthropicAPIKey,
		BaseURL: cfg.AnthropicBaseURL,
	})

	// Start hourly sync scheduler
	scheduler := svc.New(database, llmClient)
	scheduler.Start(1 * time.Hour)

	// Start HTTP server
	srv := server.New(database, llmClient)
	log.Printf("Starting server on :%s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, srv))
}
