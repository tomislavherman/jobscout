package sources

type SourceConfig struct {
	ID       int64
	Type     string
	Name     string
	FeedType string
}

var Sources = []SourceConfig{
	{ID: 1, Type: "askhn", Name: "Ask HN: Who is Hiring?", FeedType: "hiring"},
	{ID: 2, Type: "askhn", Name: "Ask HN: Seeking Freelancer?", FeedType: "freelancer"},
}

func SourceByID(id int64) *SourceConfig {
	for i := range Sources {
		if Sources[i].ID == id {
			return &Sources[i]
		}
	}
	return nil
}
